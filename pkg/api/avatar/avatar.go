// Copyright 2014 The Gogs Authors. All rights reserved.
// Use of this source code is governed by a MIT-style
// license that can be found in the LICENSE file.

// Code from https://github.com/gogits/gogs/blob/v0.7.0/modules/avatar/avatar.go

package avatar

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"sync"
	"time"

	gocache "github.com/patrickmn/go-cache"

	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

const (
	gravatarSource = "https://secure.gravatar.com/avatar/"
)

// Avatar represents the avatar object.
type Avatar struct {
	hash      string
	data      *bytes.Buffer
	notFound  bool
	isCustom  bool
	timestamp time.Time
}

var (
	alog = log.New("avatar")
	// Represents a singleton AvatarCacheServer instance
	csi *AvatarCacheServer
	// Paremeters needed to fetch Gravatar with a retro fallback
	gravatarReqParams = url.Values{
		"d":    {"retro"},
		"size": {"200"},
		"r":    {"pg"},
	}.Encode()
	// Parameters needed to see if a Gravatar is custom
	hasCustomReqParams = url.Values{
		"d": {"404"},
	}.Encode()
	cacheInitOnce sync.Once
)

func New(hash string) *Avatar {
	return &Avatar{hash: hash}
}

func (a *Avatar) Expired() bool {
	return time.Since(a.timestamp) > (time.Minute * 10)
}

func (a *Avatar) Encode(wr io.Writer) error {
	_, err := wr.Write(a.data.Bytes())
	return err
}

func (a *Avatar) update(baseUrl string) (err error) {
	customUrl := baseUrl + a.hash + "?"
	select {
	case <-time.After(time.Second * 3):
		err = fmt.Errorf("get gravatar image %s timeout", a.hash)
	case err = <-thunder.GoFetch(customUrl, a):
	}
	return err
}

func (a *Avatar) GetIsCustom() bool {
	return a.isCustom
}

// Quick error handler to avoid multiple copy pastes
func (a *Avatar) setAvatarNotFound() {
	a.notFound = true
	a.isCustom = false
}

type AvatarCacheServer struct {
	cfg      *setting.Cfg
	notFound *Avatar
	cache    *gocache.Cache
}

var validMD5 = regexp.MustCompile("^[a-fA-F0-9]{32}$")

func (a *AvatarCacheServer) Handler(ctx *contextmodel.ReqContext) {
	hash := web.Params(ctx.Req)[":hash"]

	if len(hash) != 32 || !validMD5.MatchString(hash) {
		ctx.JsonApiErr(404, "Avatar not found", nil)
		return
	}

	avatar := a.GetAvatarForHash(hash)

	ctx.Resp.Header().Set("Content-Type", "image/jpeg")

	if !a.cfg.EnableGzip {
		ctx.Resp.Header().Set("Content-Length", strconv.Itoa(len(avatar.data.Bytes())))
	}

	ctx.Resp.Header().Set("Cache-Control", "private, max-age=3600")

	if err := avatar.Encode(ctx.Resp); err != nil {
		ctx.Logger.Warn("avatar encode error:", "err", err)
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
	}
}

func (a *AvatarCacheServer) GetAvatarForHash(hash string) *Avatar {
	if setting.DisableGravatar {
		alog.Warn("'GetGravatarForHash' called despite gravatars being disabled; returning default profile image")
		return a.notFound
	}
	return a.getAvatarForHash(hash, gravatarSource)
}

func (a *AvatarCacheServer) getAvatarForHash(hash string, baseUrl string) *Avatar {
	var avatar *Avatar
	obj, exists := a.cache.Get(hash)
	if exists {
		avatar = obj.(*Avatar)
	} else {
		avatar = New(hash)
	}

	if avatar.Expired() {
		// The cache item is either expired or newly created, update it from the server
		if err := avatar.update(baseUrl); err != nil {
			alog.Debug("avatar update", "err", err)
			avatar = a.notFound
		}
	}

	if avatar.notFound {
		avatar = a.notFound
	} else if !exists {
		if err := a.cache.Add(hash, avatar, gocache.DefaultExpiration); err != nil {
			alog.Debug("add avatar to cache", "err", err)
		}
	}
	return avatar
}

// Access cache server singleton instance
func ProvideAvatarCacheServer(cfg *setting.Cfg) *AvatarCacheServer {
	cacheInitOnce.Do(func() {
		csi = newCacheServer(cfg)
	})

	return csi
}

func newCacheServer(cfg *setting.Cfg) *AvatarCacheServer {
	return &AvatarCacheServer{
		cfg:      cfg,
		notFound: newNotFound(cfg),
		cache:    gocache.New(time.Hour, time.Hour*2),
	}
}

func newNotFound(cfg *setting.Cfg) *Avatar {
	avatar := &Avatar{
		notFound: true,
		isCustom: false,
	}

	// load user_profile png into buffer
	// It's safe to ignore gosec warning G304 since the variable part of the file path comes from a configuration
	// variable.
	// nolint:gosec
	path := filepath.Join(cfg.StaticRootPath, "img", "user_profile.png")
	// It's safe to ignore gosec warning G304 since the variable part of the file path comes from a configuration
	// variable.
	// nolint:gosec
	if data, err := os.ReadFile(path); err != nil {
		alog.Error("Failed to read user_profile.png", "path", path)
	} else {
		avatar.data = bytes.NewBuffer(data)
	}

	return avatar
}

// thunder downloader
var thunder = &Thunder{QueueSize: 10}

type Thunder struct {
	QueueSize int // download queue size
	q         chan *thunderTask
	once      sync.Once
}

func (t *Thunder) init() {
	if t.QueueSize < 1 {
		t.QueueSize = 1
	}
	t.q = make(chan *thunderTask, t.QueueSize)
	for i := 0; i < t.QueueSize; i++ {
		go func() {
			for {
				task := <-t.q
				task.Fetch()
			}
		}()
	}
}

func (t *Thunder) Fetch(baseUrl string, avatar *Avatar) error {
	t.once.Do(t.init)
	task := &thunderTask{
		BaseUrl: baseUrl,
		Avatar:  avatar,
	}
	task.Add(1)
	t.q <- task
	task.Wait()
	return task.err
}

func (t *Thunder) GoFetch(baseUrl string, avatar *Avatar) chan error {
	c := make(chan error)
	go func() {
		c <- t.Fetch(baseUrl, avatar)
	}()
	return c
}

// thunder download
type thunderTask struct {
	BaseUrl string
	Avatar  *Avatar
	sync.WaitGroup
	err error
}

func (a *thunderTask) Fetch() {
	a.err = a.fetch()
	a.Done()
}

var client = &http.Client{
	Timeout:   time.Second * 2,
	Transport: &http.Transport{Proxy: http.ProxyFromEnvironment},
}

// We fetch the same url with param tweaks twice in a row
// Break out the fetch function in a way that makes each
// Portion highly reusable
func (a *thunderTask) fetch() error {
	a.Avatar.timestamp = time.Now()

	alog.Debug("avatar.fetch(fetch new avatar)", "url", a.BaseUrl)
	// First do the fetch to get the Gravatar with a retro icon fallback
	err := performGet(a.BaseUrl+gravatarReqParams, a.Avatar, getGravatarHandler)

	if err == nil {
		// Next do a fetch with a 404 fallback to see if it's a custom gravatar
		return performGet(a.BaseUrl+hasCustomReqParams, a.Avatar, checkIsCustomHandler)
	}
	return err
}

type ResponseHandler func(av *Avatar, resp *http.Response) error

// Verifies the Gravatar response code was 200, then stores the image byte slice
func getGravatarHandler(av *Avatar, resp *http.Response) error {
	if resp.StatusCode != http.StatusOK {
		av.setAvatarNotFound()
		return fmt.Errorf("status code: %d", resp.StatusCode)
	}

	av.data = &bytes.Buffer{}
	writer := bufio.NewWriter(av.data)

	_, err := io.Copy(writer, resp.Body)
	return err
}

// Uses the d=404 fallback to see if the gravatar we got back is custom
func checkIsCustomHandler(av *Avatar, resp *http.Response) error {
	av.isCustom = resp.StatusCode != http.StatusNotFound
	return nil
}

// Reusable Get helper that allows us to pass in custom handling depending on the endpoint
func performGet(url string, av *Avatar, handler ResponseHandler) error {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/jpeg,image/png,*/*;q=0.8")
	req.Header.Set("Accept-Encoding", "deflate,sdch")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.8")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/33.0.1750.154 Safari/537.36")
	alog.Debug("Fetching avatar url with parameters", "url", url)
	resp, err := client.Do(req)
	if err != nil {
		av.setAvatarNotFound()
		return fmt.Errorf("gravatar unreachable: %w", err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			alog.Warn("Failed to close response body", "err", err)
		}
	}()

	err = handler(av, resp)
	return err
}
