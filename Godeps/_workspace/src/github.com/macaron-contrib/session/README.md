session
=======

Middleware session is the session manager of [Macaron](https://github.com/Unknwon/macaron). It can use many session providers, including cookie, memory, file, redis, memcache, PostgreSQL, MySQL, and couchbase.

[API Reference](https://gowalker.org/github.com/macaron-contrib/session)

### Installation

	go get github.com/macaron-contrib/session

## Usage

```go
import (
	"github.com/Unknwon/macaron"
	"github.com/macaron-contrib/session"
)

func main() {
  	m := macaron.Classic()
  	m.Use(session.Sessioner())
	
	m.Get("/", func(sess session.Store) string {
		sess.Set("session", "session middleware")
		return sess.Get("session").(string)
	})
	
	m.Get("/signup", func(ctx *macaron.Context, f *session.Flash) {
		f.Success("yes!!!")
		f.Error("opps...")
		// Use following fields in template
		// - {{.Flash.SuccessMsg}}
		// - {{.Flash.ErrorMsg}}
		ctx.HTML(200, "signup", ctx.Data)
	})

	m.Run()
}
```

To use redis, memcache, PostgreSQL, MySQL, or couchbase as adapter, you should import their init functions:

```go
import (
	_ "github.com/macaron-contrib/session/redis"
	_ "github.com/macaron-contrib/session/memcache"
	_ "github.com/macaron-contrib/session/postgres"
	_ "github.com/macaron-contrib/session/mysql"
	_ "github.com/macaron-contrib/session/couchbase"
)
```

## Options

`session.Sessioner` comes with a variety of configuration options:

```go
// ...
m.Use(session.Sessioner(session.Options{
	Provider:		"memory", // Name of provider.
	Config: Config{
		CookieName:		"MacaronSession", // Key name store in cookie.
		Gclifetime:		3600, // GC interval for memory adapter.
		ProviderConfig:	"./tmp", // Provider configuration string.
	},
}))
// ...
```

### Example Options

- memory:

	```go
	// ...
	m.Use(session.Sessioner(session.Options{
		Provider:		"memory", // Name of provider.
		Config: Config{
			CookieName:		"MacaronSession", // Key name store in cookie.
			Gclifetime:		3600, // GC interval for memory adapter.
			ProviderConfig:	"./tmp", // Provider configuration string.
		},
	}))
	// ...
	```

- file:

	```go
	// ...
	m.Use(session.Sessioner(session.Options{
		Provider:		"file", // Name of provider.
		Config: Config{
			CookieName:		"MacaronSession", // Key name store in cookie.
			Gclifetime:		3600, // GC interval for memory adapter.
			ProviderConfig:	"./tmp", // Provider configuration string.
		},
	}))
	// ...
	```

- Redis:

	```go
	// ...
	m.Use(session.Sessioner(session.Options{
		Provider:		"redis", // Name of provider.
		Config: Config{
			CookieName:		"MacaronSession", // Key name store in cookie.
			Gclifetime:		3600, // GC interval for memory adapter.
			ProviderConfig:	"127.0.0.1:6379,100,macaron", // Provider configuration string.
		},
	}))
	// ...
	```

- MySQL:

	```go
	// ...
	m.Use(session.Sessioner(session.Options{
		Provider:		"mysql", // Name of provider.
		Config: Config{
			CookieName:		"MacaronSession", // Key name store in cookie.
			Gclifetime:		3600, // GC interval for memory adapter.
			ProviderConfig:	"username:password@protocol(address)/dbname?param=value", // Provider configuration string.
		},
	}))
	// ...
	```

- Cookie:

	```go
	// ...
	m.Use(session.Sessioner(session.Options{
		Provider:		"cookie", // Name of provider.
		Config: Config{
			CookieName:		"MacaronSession", // Key name store in cookie.
			Gclifetime:		3600, // GC interval for memory adapter.
			ProviderConfig:	"{\"cookieName\":\"gosessionid\",\"securityKey\":\"beegocookiehashkey\"}", // Provider configuration string.
		},
	}))
	// ...
	```

## How to write own provider?

When you develop a web app, maybe you want to write own provider because you must meet the requirements.

Writing a provider is easy. You only need to define two struct types 
(Session and Provider), which satisfy the interface definition. 
Maybe you will find the **memory** provider is a good example.

	type Store interface {
		Set(key, value interface{}) error     //set session value
		Get(key interface{}) interface{}      //get session value
		Delete(key interface{}) error         //delete session value
		SessionID() string                    //back current sessionID
		SessionRelease(w http.ResponseWriter) // release the resource & save data to provider & return the data
		Flush() error                         //delete all data
	}
	
	type Provider interface {
		SessionInit(gclifetime int64, config string) error
		SessionRead(sid string) (SessionStore, error)
		SessionExist(sid string) bool
		SessionRegenerate(oldsid, sid string) (Store, error)
		SessionDestroy(sid string) error
		SessionAll() int //get all active session
		SessionGC()
	}


## License

This project is under Apache v2 License. See the [LICENSE](LICENSE) file for the full license text.
