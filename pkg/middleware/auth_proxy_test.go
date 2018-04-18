package middleware

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/login"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/session"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/macaron.v1"
)

func TestAuthProxyWithLdapEnabled(t *testing.T) {
	Convey("When calling sync grafana user with ldap user", t, func() {

		setting.LdapEnabled = true
		setting.AuthProxyLdapSyncTtl = 60

		servers := []*login.LdapServerConf{{Host: "127.0.0.1"}}
		login.LdapCfg = login.LdapConfig{Servers: servers}
		mockLdapAuther := mockLdapAuthenticator{}

		login.NewLdapAuthenticator = func(server *login.LdapServerConf) login.ILdapAuther {
			return &mockLdapAuther
		}

		Convey("When user logs in, call SyncUser", func() {
			// arrange
			sess := newMockSession()
			ctx := m.ReqContext{Session: &sess}
			So(sess.Get(session.SESS_KEY_LASTLDAPSYNC), ShouldBeNil)

			// act
			syncGrafanaUserWithLdapUser(&m.LoginUserQuery{
				ReqContext: &ctx,
				Username:   "test",
			})

			// assert
			So(mockLdapAuther.syncUserCalled, ShouldBeTrue)
			So(sess.Get(session.SESS_KEY_LASTLDAPSYNC), ShouldBeGreaterThan, 0)
		})

		Convey("When session variable not expired, don't sync and don't change session var", func() {
			// arrange
			sess := newMockSession()
			ctx := m.ReqContext{Session: &sess}
			now := time.Now().Unix()
			sess.Set(session.SESS_KEY_LASTLDAPSYNC, now)
			sess.Set(AUTH_PROXY_SESSION_VAR, "test")

			// act
			syncGrafanaUserWithLdapUser(&m.LoginUserQuery{
				ReqContext: &ctx,
				Username:   "test",
			})

			// assert
			So(sess.Get(session.SESS_KEY_LASTLDAPSYNC), ShouldEqual, now)
			So(mockLdapAuther.syncUserCalled, ShouldBeFalse)
		})

		Convey("When lastldapsync is expired, session variable should be updated", func() {
			// arrange
			sess := newMockSession()
			ctx := m.ReqContext{Session: &sess}
			expiredTime := time.Now().Add(time.Duration(-120) * time.Minute).Unix()
			sess.Set(session.SESS_KEY_LASTLDAPSYNC, expiredTime)
			sess.Set(AUTH_PROXY_SESSION_VAR, "test")

			// act
			syncGrafanaUserWithLdapUser(&m.LoginUserQuery{
				ReqContext: &ctx,
				Username:   "test",
			})

			// assert
			So(sess.Get(session.SESS_KEY_LASTLDAPSYNC), ShouldBeGreaterThan, expiredTime)
			So(mockLdapAuther.syncUserCalled, ShouldBeTrue)
		})
	})
}

type mockSession struct {
	value map[interface{}]interface{}
}

func newMockSession() mockSession {
	session := mockSession{}
	session.value = make(map[interface{}]interface{})
	return session
}

func (s *mockSession) Start(c *macaron.Context) error {
	return nil
}

func (s *mockSession) Set(k interface{}, v interface{}) error {
	s.value[k] = v
	return nil
}

func (s *mockSession) Get(k interface{}) interface{} {
	return s.value[k]
}

func (s *mockSession) Delete(k interface{}) interface{} {
	delete(s.value, k)
	return nil
}

func (s *mockSession) ID() string {
	return ""
}

func (s *mockSession) Release() error {
	return nil
}

func (s *mockSession) Destory(c *macaron.Context) error {
	return nil
}

func (s *mockSession) RegenerateId(c *macaron.Context) error {
	return nil
}

type mockLdapAuthenticator struct {
	syncUserCalled bool
}

func (a *mockLdapAuthenticator) Login(query *m.LoginUserQuery) error {
	return nil
}

func (a *mockLdapAuthenticator) SyncUser(query *m.LoginUserQuery) error {
	a.syncUserCalled = true
	return nil
}

func (a *mockLdapAuthenticator) GetGrafanaUserFor(ctx *m.ReqContext, ldapUser *login.LdapUserInfo) (*m.User, error) {
	return nil, nil
}
