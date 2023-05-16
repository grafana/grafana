import { check } from "k6";
import http from "k6/http";

import { loginAdmin, login } from "../../lib/api.js";
import { url } from "../../lib/env.js";
import { userAPI } from "../../lib/users.js";
import { rand } from "../../lib/util.js";

export let options = {
  vus: 10,
  setupTimeout: "5s",
  duration: "30s",
};

export default function (data) {
  loginAdmin(true);
  const u = userAPI.create(userAPI.skel(rand.uid()));

  login(u.login, u.password, true);
  let res = http.get(url + "/api/user");
  check(res, {
    "is status 200": (r) => r.status === 200,
    "username is correct": (r) => r.json("login") === u.login,
  });

  loginAdmin(true);
  userAPI.del(u);
}
