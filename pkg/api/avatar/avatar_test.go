package avatar

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

const DEFAULT_NONSENSE_HASH string = "9e107d9d372bb6826bd81d3542a419d6"
const CUSTOM_NONSENSE_HASH string = "d2a9116d4a63304733ca0f3471e57d16"

var NONSENSE_BODY []byte = []byte("Bogus API response")

func TestAvatar_AvatarRetrieval(t *testing.T) {
	avc := ProvideAvatarCacheServer(setting.NewCfg())
	callCounter := 0
	mockServer := setupMockGravatarServer(&callCounter, false)

	t.Cleanup(func() {
		avc.cache.Flush()
		mockServer.Close()
	})

	av := avc.getAvatarForHash(DEFAULT_NONSENSE_HASH, mockServer.URL+"/avatar/")
	// verify there was a call to get the image and a call to the 404 fallback
	require.Equal(t, callCounter, 2)
	require.Equal(t, av.data.Bytes(), NONSENSE_BODY)

	avc.getAvatarForHash(DEFAULT_NONSENSE_HASH, mockServer.URL+"/avatar/")
	//since the avatar is cached, there should not have been anymore REST calls
	require.Equal(t, callCounter, 2)
}

func TestAvatar_CheckCustom(t *testing.T) {
	avc := ProvideAvatarCacheServer(setting.NewCfg())
	callCounter := 0
	mockServer := setupMockGravatarServer(&callCounter, false)

	t.Cleanup(func() {
		avc.cache.Flush()
		mockServer.Close()
	})

	av := avc.getAvatarForHash(DEFAULT_NONSENSE_HASH, mockServer.URL+"/avatar/")
	// verify this avatar is not marked custom
	require.False(t, av.isCustom)

	av2 := avc.getAvatarForHash(CUSTOM_NONSENSE_HASH, mockServer.URL+"/avatar/")
	// verify this avatar is marked custom
	require.True(t, av2.isCustom)
}

func TestAvatar_FallbackCase(t *testing.T) {
	avc := ProvideAvatarCacheServer(setting.NewCfg())
	callCounter := 0
	mockServer := setupMockGravatarServer(&callCounter, true)

	t.Cleanup(func() {
		avc.cache.Flush()
		mockServer.Close()
	})

	av := avc.getAvatarForHash(DEFAULT_NONSENSE_HASH, mockServer.URL+"/avatar/")
	// the client should not have gotten a valid response back from the first call
	// there should only be one REST call, and the avatar url should be the default
	require.Equal(t, callCounter, 1)
	require.False(t, av.isCustom)
	require.True(t, av.notFound)
	require.Equal(t, av, avc.notFound)
}

func TestAvatar_ExpirationHandler(t *testing.T) {
	avc := ProvideAvatarCacheServer(setting.NewCfg())
	callCounter := 0
	mockServer := setupMockGravatarServer(&callCounter, false)

	t.Cleanup(func() {
		avc.cache.Flush()
		mockServer.Close()
	})

	av := avc.getAvatarForHash(DEFAULT_NONSENSE_HASH, mockServer.URL+"/avatar/")
	// verify there was a call to get the image and a call to the 404 fallback
	require.Equal(t, callCounter, 2)
	require.Equal(t, av.data.Bytes(), NONSENSE_BODY)

	// manually expire the avatar in the cache
	av.timestamp = av.timestamp.Add(-time.Minute * 15)
	avc.getAvatarForHash(DEFAULT_NONSENSE_HASH, mockServer.URL+"/avatar/")
	//since the avatar is expired, there should be two more REST calls
	require.Equal(t, callCounter, 4)
}

func setupMockGravatarServer(counter *int, simulateError bool) *httptest.Server {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		(*counter)++
		splitUri := strings.Split(r.RequestURI, "?")
		urlHash := splitUri[0][len("/avatar/"):]
		params := splitUri[1]
		if params == "d=404" {
			if urlHash == DEFAULT_NONSENSE_HASH {
				w.WriteHeader(404)
			} else {
				_, _ = w.Write(NONSENSE_BODY)
			}
		} else {
			if simulateError {
				w.WriteHeader(500)
			} else {
				_, _ = w.Write(NONSENSE_BODY)
			}
		}
	}))
	return server
}
