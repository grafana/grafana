import { check } from "k6";
import http from "k6/http";

import { url } from "./env.js";

/**
 * Functions for interacting with Grafana's users.
 */
export class userAPI {
  /**
   * @typedef {{id: number, name: string, login: string, email: string, password: string, orgs: Object.<number, userRole>}} User
   */

  /**
   * Creates an object that can be passed to userAPI.create to create a user.
   *
   * @static
   * @param {string} name The username for the created user.
   * @param {Object.<number, userRole>} [orgs] If set, each key represents an org with the value being the role that the user should assume within that organization.
   * @returns {User}
   */
  static skel(name, orgs = {}) {
    return {
      name: "k6 " + name,
      email: name + "@example.org",
      login: name,
      orgs: orgs,
      password: __ENV.GT_NEW_USER_PASSWORD || 'correct horse battery staple',
    };
  }

  /**
   * Creates a single user.
   *
   * @param {User} u Describes the user that is to be created.
   * @returns {User} The updated user object with the ID for the newly created user added.
   */
  static create(u) {
    const org = u.orgs && u.orgs.length > 0 ? Object.keys(u.orgs)[0] : 0;

    const res = http.post(
      url + "/api/admin/users",
      JSON.stringify({
        name: u.name,
        email: u.email,
        login: u.login,
        password: u.password,
        org: org,
      }),
      {
        tags: "create",
        headers: { "Content-Type": "application/json" },
      }
    );
    check(res, {
      "successfully created user": (r) => r.status === 200,
    });

    if (res.status !== 200) {
      console.error("failed to create user:", res.body);
      return u;
    }

    u.id = res.json("id");

    for (let org in u.orgs) {
      setOrgRole(u, org, u.orgs[org]);
    }

    return u;
  }

  /**
   * Deletes multiple users.
   *
   * @param {User[]} users
   */
  static deleteMany(users) {
    users.forEach(userAPI.del);
  }

  /**
   * Deletes a single user.
   *
   * @param {User} user
   */
  static del(user) {
    const res = http.del(http.url`${url}/api/admin/users/${user.id}`, null, {
      tags: "delete",
    });
    check(res, {
      "delete user status is 200": (r) => r.status === 200,
    });
  }
};

/**
 * @typedef userRole
 * @enum {string}
 */
const userRole = {
  Viewer: "Viewer",
  Editor: "Editor",
  Admin: "Admin",
}

function getOrgs(u) {
  const res = http.get(`${url}/api/users/${u.id}/orgs`, null, {
    tags: "getOrgs",
  });
  check(res, {
    "successfully able to get current organization for user": (r) =>
      r.status === 200,
  });
  if (res.status !== 200) {
    console.warn(
      "tried to get current organization for user, but failed",
      "login=",
      u.login,
      "response=",
      res
    );
    return [];
  }

  // Convert to an object for easy lookup.
  const orgList = res.json();
  const orgs = {};
  for (let i in orgList) {
    orgs[orgList[i].orgId] = orgList[i];
  }

  return orgs;
}

function setOrgRole(u, org, role) {
  const orgs = getOrgs(u);
  let verb = "POST";
  let path = http.url`${url}/api/orgs/${org}/users`;
  let payload = JSON.stringify({
    loginOrEmail: u.login,
    role: role,
  });

  if (org in orgs) {
    verb = "PATCH";
    path = http.url`${url}/api/orgs/${org}/users/${u.id}`;
    payload = JSON.stringify({
      role: role,
    });
  }

  const res = http.request(verb, path, payload, {
    tags: "setRole",
    headers: { "Content-Type": "application/json" },
  });

  check(res, {
    "successfully set user role in org": (r) => r.status === 200,
  });
  if (res.status !== 200) {
    console.warn("tried to set user role, but failed:", res);
  }
}
