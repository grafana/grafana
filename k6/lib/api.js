import { check } from "k6";
import http from "k6/http";

import { url } from "./env.js";

/**
 * Login creates a new session.
 * K6 stores cookies in a cookie jar, by logging in we'll be assigned a cookie. This reflects typical end-user behavior better than using cookies or API keys would.
 *
 * @param {string} username
 * @param {string} password
 * @param {boolean} [forceNewSession]
 */
export function login(username, password, forceNewSession = false) {
  if (!forceNewSession) {
    const jar = http.cookieJar();
    if (jar.cookiesForURL(url)["grafana_session"]) {
      return;
    }
  }

  // Create a new session.
  const res = http.post(
    url + "/login",
    JSON.stringify({ user: username, password: password }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { type: "auth", op: "login" },
    }
  );

  check(res, {
    "successfully logged in": (r) => r.status === 200,
  });
}

/**
 * Same as login but uses admin:admin by default optionally overridden by environment variables.
 *
 * - Use GT_USERNAME to override the username used to login.
 * - Use GT_PASSWORD to override the password used to login.
 *
 * @param forceNewSession
 */
export function loginAdmin(forceNewSession = false) {
  const uname = __ENV.GT_USERNAME ? __ENV.GT_USERNAME : "admin";
  const password = __ENV.GT_PASSWORD ? __ENV.GT_PASSWORD : "admin";

  return login(uname, password, forceNewSession);
}
