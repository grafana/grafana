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
	"io/ioutil"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"strconv"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"

	gocache "github.com/patrickmn/go-cache"
)

const (
	gravatarSource = "https://secure.gravatar.com/avatar/"
)

// Avatar represents the avatar object.
type Avatar struct {
	hash      string
	reqParams string
	data      *bytes.Buffer
	notFound  bool
	timestamp time.Time
}

func New(hash string) *Avatar {
	return &Avatar{
		hash: hash,
		reqParams: url.Values{
			"d":    {"retro"},
			"size": {"200"},
			"r":    {"pg"}}.Encode(),
	}
}

func (a *Avatar) Expired() bool {
	return time.Since(a.timestamp) > (time.Minute * 10)
}

func (a *Avatar) Encode(wr io.Writer) error {
	_, err := wr.Write(a.data.Bytes())
	return err
}

func (a *Avatar) Update() (err error) {
	select {
	case <-time.After(time.Second * 3):
		err = fmt.Errorf("get gravatar image %s timeout", a.hash)
	case err = <-thunder.GoFetch(gravatarSource+a.hash+"?"+a.reqParams, a):
	}
	return err
}

type CacheServer struct {
	cfg      *setting.Cfg
	notFound *Avatar
	cache    *gocache.Cache
}

var validMD5 = regexp.MustCompile("^[a-fA-F0-9]{32}$")

func (a *CacheServer) Handler(ctx *models.ReqContext) {
	hash := ctx.Params("hash")

	if len(hash) != 32 || !validMD5.MatchString(hash) {
		ctx.JsonApiErr(404, "Avatar not found", nil)
		return
	}

	var avatar *Avatar
	obj, exists := a.cache.Get(hash)
	if exists {
		avatar = obj.(*Avatar)
	} else {
		avatar = New(hash)
	}

	if avatar.Expired() {
		// The cache item is either expired or newly created, update it from the server
		if err := avatar.Update(); err != nil {
			log.Tracef("avatar update error: %v", err)
			avatar = a.notFound
		}
	}

	if avatar.notFound {
		avatar = a.notFound
	} else if !exists {
		if err := a.cache.Add(hash, avatar, gocache.DefaultExpiration); err != nil {
			log.Tracef("Error adding avatar to cache: %s", err)
		}
	}

	ctx.Resp.Header().Set("Content-Type", "image/jpeg")

	if !a.cfg.EnableGzip {
		ctx.Resp.Header().Set("Content-Length", strconv.Itoa(len(avatar.data.Bytes())))
	}

	ctx.Resp.Header().Set("Cache-Control", "private, max-age=3600")

	if err := avatar.Encode(ctx.Resp); err != nil {
		log.Warnf("avatar encode error: %v", err)
		ctx.Resp.WriteHeader(500)
	}
}

func NewCacheServer(cfg *setting.Cfg) *CacheServer {
	return &CacheServer{
		cfg:      cfg,
		notFound: newNotFound(cfg),
		cache:    gocache.New(time.Hour, time.Hour*2),
	}
}

func newNotFound(cfg *setting.Cfg) *Avatar {
	avatar := &Avatar{notFound: true}

	// load user_profile png into buffer
	// It's safe to ignore gosec warning G304 since the variable part of the file path comes from a configuration
	// variable.
	// nolint:gosec
	path := filepath.Join(cfg.StaticRootPath, "img", "user_profile.png")
	// It's safe to ignore gosec warning G304 since the variable part of the file path comes from a configuration
	// variable.
	// nolint:gosec
	if data, err := ioutil.ReadFile(path); err != nil {
		log.Errorf(3, "Failed to read user_profile.png, %v", path)
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

func (t *Thunder) Fetch(url string, avatar *Avatar) error {
	t.once.Do(t.init)
	task := &thunderTask{
		Url:    url,
		Avatar: avatar,
	}
	task.Add(1)
	t.q <- task
	task.Wait()
	return task.err
}

func (t *Thunder) GoFetch(url string, avatar *Avatar) chan error {
	c := make(chan error)
	go func() {
		c <- t.Fetch(url, avatar)
	}()
	return c
}

// thunder download
type thunderTask struct {
	Url    string
	Avatar *Avatar
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

func (a *thunderTask) fetch() error {
	a.Avatar.timestamp = time.Now()

	log.Debugf("avatar.fetch(fetch new avatar): %s", a.Url)
	req, err := http.NewRequest("GET", a.Url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/jpeg,image/png,*/*;q=0.8")
	req.Header.Set("Accept-Encoding", "deflate,sdch")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.8")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/33.0.1750.154 Safari/537.36")
	resp, err := client.Do(req)
	if err != nil {
		a.Avatar.notFound = true
		return fmt.Errorf("gravatar unreachable: %w", err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			log.Warn("Failed to close response body", "err", err)
		}
	}()

	if resp.StatusCode != 200 {
		a.Avatar.notFound = true
		return fmt.Errorf("status code: %d", resp.StatusCode)
	}

	a.Avatar.data = &bytes.Buffer{}
	writer := bufio.NewWriter(a.Avatar.data)

	_, err = io.Copy(writer, resp.Body)
	return err
}
