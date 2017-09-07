package api

import "testing"

func TestRouteRegister(t *testing.T) {

	rr := &routeRegister{
		prefix: "",
		routes: []route{},
	}

	rr.Delete("/admin")
	rr.Get("/down")

	rr.Group("/user", func(innerRR RouteRegister) {
		innerRR.Delete("")
		innerRR.Get("/friends")
	})

	println("len", len(rr.routes))

	if rr.routes[0].pattern != "/admin" && rr.routes[0].method != "DELETE" {
		t.Errorf("expected first route to be DELETE /admin")
	}

	if rr.routes[1].pattern != "/down" && rr.routes[1].method != "GET" {
		t.Errorf("expected first route to be GET /down")
	}

	println("len", len(rr.routes))

	if rr.routes[2].pattern != "/user" && rr.routes[2].method != "DELETE" {
		t.Errorf("expected first route to be DELETE /admin")
	}

	if rr.routes[3].pattern != "/user/friends" && rr.routes[3].method != "GET" {
		t.Errorf("expected first route to be GET /down")
	}
}
