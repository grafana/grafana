package routing

import (
	"net/http"
	"strconv"
	"testing"

	"gopkg.in/macaron.v1"
)

type fakeRouter struct {
	route []route
}

func (fr *fakeRouter) Handle(method, pattern string, handlers []macaron.Handler) *macaron.Route {
	fr.route = append(fr.route, route{
		pattern:  pattern,
		method:   method,
		handlers: handlers,
	})

	return &macaron.Route{}
}

func (fr *fakeRouter) Get(pattern string, handlers ...macaron.Handler) *macaron.Route {
	fr.route = append(fr.route, route{
		pattern:  pattern,
		method:   http.MethodGet,
		handlers: handlers,
	})

	return &macaron.Route{}
}

func emptyHandlers(n int) []macaron.Handler {
	var res []macaron.Handler
	for i := 1; n >= i; i++ {
		res = append(res, emptyHandler(strconv.Itoa(i)))
	}
	return res
}

func emptyHandler(name string) macaron.Handler {
	return struct{ name string }{name: name}
}

func TestRouteSimpleRegister(t *testing.T) {
	testTable := []route{
		{method: "DELETE", pattern: "/admin", handlers: emptyHandlers(2)},
		{method: "GET", pattern: "/down", handlers: emptyHandlers(3)},
	}

	// Setup
	rr := NewRouteRegister(emptyHandler)

	rr.Delete("/admin", emptyHandler("1"))
	rr.Get("/down", emptyHandler("1"), emptyHandler("2"))

	fr := &fakeRouter{}
	rr.Register(fr)

	// Validation
	if len(fr.route) != len(testTable) {
		t.Errorf("want %v routes, got %v", len(testTable), len(fr.route))
	}

	for i := range testTable {
		if testTable[i].method != fr.route[i].method {
			t.Errorf("want %s got %v", testTable[i].method, fr.route[i].method)
		}

		if testTable[i].pattern != fr.route[i].pattern {
			t.Errorf("want %s got %v", testTable[i].pattern, fr.route[i].pattern)
		}

		if len(testTable[i].handlers) != len(fr.route[i].handlers) {
			t.Errorf("want %d handlers got %d handlers \ntestcase: %v\nroute: %v\n",
				len(testTable[i].handlers),
				len(fr.route[i].handlers),
				testTable[i],
				fr.route[i])
		}
	}
}

func TestRouteGroupedRegister(t *testing.T) {
	testTable := []route{
		{method: "DELETE", pattern: "/admin", handlers: emptyHandlers(1)},
		{method: "GET", pattern: "/down", handlers: emptyHandlers(2)},
		{method: "POST", pattern: "/user", handlers: emptyHandlers(1)},
		{method: "PUT", pattern: "/user/friends", handlers: emptyHandlers(1)},
		{method: "DELETE", pattern: "/user/admin", handlers: emptyHandlers(2)},
		{method: "GET", pattern: "/user/admin/all", handlers: emptyHandlers(4)},
	}

	// Setup
	rr := NewRouteRegister()

	rr.Delete("/admin", emptyHandler("1"))
	rr.Get("/down", emptyHandler("1"), emptyHandler("2"))

	rr.Group("/user", func(user RouteRegister) {
		user.Post("", emptyHandler("1"))
		user.Put("/friends", emptyHandler("2"))

		user.Group("/admin", func(admin RouteRegister) {
			admin.Delete("", emptyHandler("3"))
			admin.Get("/all", emptyHandler("3"), emptyHandler("4"), emptyHandler("5"))
		}, emptyHandler("3"))
	})

	fr := &fakeRouter{}
	rr.Register(fr)

	// Validation
	if len(fr.route) != len(testTable) {
		t.Errorf("want %v routes, got %v", len(testTable), len(fr.route))
	}

	for i := range testTable {
		if testTable[i].method != fr.route[i].method {
			t.Errorf("want %s got %v", testTable[i].method, fr.route[i].method)
		}

		if testTable[i].pattern != fr.route[i].pattern {
			t.Errorf("want %s got %v", testTable[i].pattern, fr.route[i].pattern)
		}

		if len(testTable[i].handlers) != len(fr.route[i].handlers) {
			t.Errorf("want %d handlers got %d handlers \ntestcase: %v\nroute: %v\n",
				len(testTable[i].handlers),
				len(fr.route[i].handlers),
				testTable[i],
				fr.route[i])
		}
	}
}
func TestRouteGroupInserting(t *testing.T) {
	testTable := []route{
		{method: http.MethodGet, pattern: "/api/", handlers: emptyHandlers(1)},
		{method: http.MethodPost, pattern: "/api/group/endpoint", handlers: emptyHandlers(1)},

		{method: http.MethodGet, pattern: "/api/group/inserted", handlers: emptyHandlers(1)},
		{method: http.MethodDelete, pattern: "/api/inserted-endpoint", handlers: emptyHandlers(1)},
	}

	// Setup
	rr := NewRouteRegister()

	rr.Group("/api", func(api RouteRegister) {
		api.Get("/", emptyHandler("1"))

		api.Group("/group", func(group RouteRegister) {
			group.Post("/endpoint", emptyHandler("1"))
		})
	})

	rr.Insert("/api", func(api RouteRegister) {
		api.Delete("/inserted-endpoint", emptyHandler("1"))
	})

	rr.Insert("/api/group", func(group RouteRegister) {
		group.Get("/inserted", emptyHandler("1"))
	})

	fr := &fakeRouter{}
	rr.Register(fr)

	// Validation
	if len(fr.route) != len(testTable) {
		t.Fatalf("want %v routes, got %v", len(testTable), len(fr.route))
	}

	for i := range testTable {
		if testTable[i].method != fr.route[i].method {
			t.Errorf("want %s got %v", testTable[i].method, fr.route[i].method)
		}

		if testTable[i].pattern != fr.route[i].pattern {
			t.Errorf("want %s got %v", testTable[i].pattern, fr.route[i].pattern)
		}

		if len(testTable[i].handlers) != len(fr.route[i].handlers) {
			t.Errorf("want %d handlers got %d handlers \ntestcase: %v\nroute: %v\n",
				len(testTable[i].handlers),
				len(fr.route[i].handlers),
				testTable[i],
				fr.route[i])
		}
	}
}

func TestDuplicateRoutShouldPanic(t *testing.T) {
	defer func() {
		if recover() != "cannot add duplicate route" {
			t.Errorf("Should cause panic if duplicate routes are added ")
		}
	}()

	rr := NewRouteRegister(emptyHandler)
	rr.Get("/api", emptyHandler("1"))
	rr.Get("/api", emptyHandler("1"))

	fr := &fakeRouter{}
	rr.Register(fr)
}
func TestNamedMiddlewareRouteRegister(t *testing.T) {
	testTable := []route{
		{method: "DELETE", pattern: "/admin", handlers: emptyHandlers(2)},
		{method: "GET", pattern: "/down", handlers: emptyHandlers(3)},
		{method: "POST", pattern: "/user", handlers: emptyHandlers(2)},
		{method: "PUT", pattern: "/user/friends", handlers: emptyHandlers(2)},
		{method: "DELETE", pattern: "/user/admin", handlers: emptyHandlers(3)},
		{method: "GET", pattern: "/user/admin/all", handlers: emptyHandlers(5)},
	}

	namedMiddlewares := map[string]bool{}
	// Setup
	rr := NewRouteRegister(func(name string) macaron.Handler {
		namedMiddlewares[name] = true

		return struct{ name string }{name: name}
	})

	rr.Delete("/admin", emptyHandler("1"))
	rr.Get("/down", emptyHandler("1"), emptyHandler("2"))

	rr.Group("/user", func(user RouteRegister) {
		user.Post("", emptyHandler("1"))
		user.Put("/friends", emptyHandler("2"))

		user.Group("/admin", func(admin RouteRegister) {
			admin.Delete("", emptyHandler("3"))
			admin.Get("/all", emptyHandler("3"), emptyHandler("4"), emptyHandler("5"))
		}, emptyHandler("3"))
	})

	fr := &fakeRouter{}
	rr.Register(fr)

	// Validation
	if len(fr.route) != len(testTable) {
		t.Errorf("want %v routes, got %v", len(testTable), len(fr.route))
	}

	for i := range testTable {
		if testTable[i].method != fr.route[i].method {
			t.Errorf("want %s got %v", testTable[i].method, fr.route[i].method)
		}

		if testTable[i].pattern != fr.route[i].pattern {
			t.Errorf("want %s got %v", testTable[i].pattern, fr.route[i].pattern)
		}

		if _, exist := namedMiddlewares[testTable[i].pattern]; !exist {
			t.Errorf("could not find named route named %s", testTable[i].pattern)
		}

		if len(testTable[i].handlers) != len(fr.route[i].handlers) {
			t.Errorf("want %d handlers got %d handlers \ntestcase: %v\nroute: %v\n",
				len(testTable[i].handlers),
				len(fr.route[i].handlers),
				testTable[i],
				fr.route[i])
		}
	}
}
