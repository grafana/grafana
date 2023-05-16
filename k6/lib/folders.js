import http from "k6/http";
import { check } from "k6";

import { url } from "./env.js";
import { rand } from "./util.js";

export function createFolders(numOfParents) {
  // Create a folder class.
  function FolderItem(uid, depth) {
    this.uid = uid;
    this.depth = depth;
  }

  // Store all folder UIDs.
  let folderUIDs = [];

  // Store highest level parent folder UIDs.
  let parentUIDs = [];

  // Generate folder counter.
  let folderList = [];

  // Generate folder structure.
  let folders = [];

  function folderStructure() {
    // Create parent folders.
    for (let i = 0; i < numOfParents; i++) {
      let uid = rand.uid();
      folderUIDs.push(uid);
      parentUIDs.push(uid);
      folderList.push(new FolderItem(uid, 0));
      folders.push({ UID: uid, Title: uid });
    }

    // Create child folders.
    while (true) {
      // Choose random folder to be parent folder.
      let parentFolder = rand.select(folderList);

      // Increment parent folder counter to account for new child.
      let childDepth = parentFolder.depth + 1;

      // If parent folder already has 7 children, break.
      if (childDepth > 7) break;

      // Else, add child folder to list.
      let childUID = rand.uid();
      folderUIDs.push(childUID);
      folderList.push(new FolderItem(childUID, childDepth));
      folders.push({
        UID: childUID,
        Title: childUID,
        ParentUID: parentFolder.uid,
      });
    }
    return folders;
  }

  folderStructure();

  console.debug("Nested folders: ", folders);
  console.info(`creating folders...`);
  // Create folders.
  const requests = folders.forEach((f) => {
    let res = http.post(url + "/api/folders/", JSON.stringify(f), {
      tags: "create",
      headers: { "Content-Type": "application/json" },
    });
    check(res, {
      "create parent folder status is 200": (r) => r.status === 200,
    });
  });

  return { folderUIDs, parentUIDs };
}

export function deleteFolders(parentUIDs) {
  console.info(`deleting folders...`);
  // Pick up our list of UIDs from the 'data' structure and create a list of batched DELETE HTTP requests.
  const requests = parentUIDs.map((f) => {
    return ["DELETE", url + "/api/folders/" + f, null, { tags: "delete" }];
  });

  const responses = http.batch(requests);
  responses.forEach((res) => {
    check(res, {
      "delete folder status is 200": (r) => r.status === 200,
    });
  });
}
