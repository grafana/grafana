import http from "k6/http";
import { check } from "k6";

import { url } from "./env.js";

export function getDashboardPermissions(dashboardUID) {
  return http.get(dashboardURL(dashboardUID)).json().map(reducePermissionsDTO);
}

export function getFolderPermissions(dashboardUID) {
  return http.get(folderURL(dashboardUID)).json().map(reducePermissionsDTO);
}

export function setDashboardPermissions(uid, permissions) {
  setPermission(dashboardURL(uid), uid, permissions);
}

export function setFolderPermissions(uid, permissions) {
  setPermission(folderURL(uid), uid, permissions);
}

function setPermission(url, uid, permissions) {
  console.debug(`updating permissions for '${uid}'`);

  const res = http.post(url, JSON.stringify({ items: permissions }), {
    tags: { type: "permissions", op: "update" },
    headers: { "Content-Type": "application/json" },
  });

  check(res, {
    "set permissions status is 200": (r) => r.status === 200,
  });

  if (res.status !== 200) {
    console.warn(
      `failed to update permissions for '${uid}', got HTTP status ${
        res.status
      } with error: ${res.json("message")}`
    );
  }
}

function dashboardURL(dashboardUID) {
  return `${url}/api/dashboards/uid/${dashboardUID}/permissions`;
}

function folderURL(folderUID) {
  return `${url}/api/folders/${folderUID}/permissions`;
}

function reducePermissionsDTO(p) {
  if (p.userId && p.userId !== 0) {
    return { userId: p.userId, permission: p.permission };
  }
  if (p.teamId && p.teamId !== 0) {
    return { teamId: p.userId, permission: p.permission };
  }
  return { role: p.role, permission: p.permission };
}
