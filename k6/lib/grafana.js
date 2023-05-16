import { userAPI } from "./users.js";
import { createDashboards, deleteDashboards } from "./dashboards.js";
import { scale } from "./env.js";
import { randomString } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

/**
 * @typedef {{users: User[], viewers: User[], editors: User[], admins: User[], dashboards: string[]}} ProvisionResult
 */

/**
 * Creates multiple randomized resources, for setup.
 *
 * @param {{dashboards: {count: number}, users: {viewers: number, editors: number, admins: number}}} conf Provisioning configuration.
 * @returns {ProvisionResult} Created resources.
 */
export function provision(conf) {
  let created = {};

  const org = 1;
  if (conf.users) {
    let viewers = conf.users.viewers * scale;
    let editors = conf.users.editors * scale;
    let admins = conf.users.admins * scale;
    console.info(
      `creating ${viewers} viewers, ${editors} editors, and ${admins} admins…`
    );
    created.viewers = randomIdentifiers(viewers)
      .map(userAPI.skel)
      .map(userAPI.create);
    created.editors = randomIdentifiers(editors)
      .map(userAPI.skel)
      .map(addOrgRoleToUserSkel(org, "Editor"))
      .map(userAPI.create);
    created.admins = randomIdentifiers(admins)
      .map(userAPI.skel)
      .map(addOrgRoleToUserSkel(org, "Admin"))
      .map(userAPI.create);
    created.users = created.viewers
      .concat(created.editors)
      .concat(created.admins);
  }
  if (conf.dashboards) {
    created.dashboards = createDashboards(conf.dashboards.count * scale);
  }

  return created;
}

/**
 * Delete resources previously created by the provision function.
 *
 * @param {ProvisionResult} data Payload from the provision function.
 */
export function cleanup(data) {
  if (data.users) {
    userAPI.deleteMany(data.users);
  }
  if (data.dashboards) {
    deleteDashboards(data.dashboards);
  }
}

function addOrgRoleToUserSkel(org, role) {
  return function (u) {
    u.orgs = {};
    u.orgs[org] = role;
    return u;
  };
}

function randomIdentifiers(length) {
  let res = [];
  for (let i = 0; i < length; i++) {
    res.push(randomString(15, "abcdefghijklmnopqrstuvxyz0123456789"));
  }
  return res;
}
