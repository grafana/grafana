
# WIP

## decisions

1. naming in the API:
   - folder + file 
   - container + item
   - bucket + object
2. path validation:
   - strict validation to accept only well-formatted paths. ignore invalid paths in list operations

## describe API

The API should be complete enough for a simple file management UI. Thus, it should support at least simple CRUD operations on files/directories and some kind of file traversal with pagination and filtering.

We need at least:
1. `getFile(path)` / `deleteFile(path)` / `upsertFile(path)`
2. `createFolder(path)` / `deleteFolder(path)`
3. `listFiles(path, recursive=true)`
   - recursive file listing
4. `listFiles(path, recursive=false)` + `listFolders(path)`
   - list files at root, lazy load files from nested folders
5. `listFiles(path, recursive=true, pagination: {size: 10, after: cursor})`
   - list with pagination
   

## research libs

- stow https://github.com/graymeta/stow
  - version 0.1.0, last commit over a year ago
  - local, s3, gcs, azureblob, openstack swift, oracle, sftp
- storage https://github.com/trusch/storage
  - last commit 5 years ago
  - levelDb, mongoDb, boltDb, local, mem, storaged, cache
- cloud development kit blob https://gocloud.dev/howto/blob/  https://github.com/google/go-cloud/blob/master/internal/docs/design.md
   - azureblob, local, gcs, in-mem, s3
   - extensible
   - need to hand roll filtering and pagination with `ListIterator`
   - can't list folders, would need to create marker blobs
   - popular and actively maintained
- gost https://github.com/usmanhalalit/gost
  - local, s3 
  - extensible
  - no filtered list
  - has concept of dirs (creates markers in s3 https://github.com/usmanhalalit/gost/blob/master/s3/directory.go#L132)
- cloudstorage https://github.com/lytics/cloudstorage
   - s3, aws, azureblob, sftp, local
   - has filtered list
- afero https://github.com/spf13/afero
   - local, in-mem, sftp, experimental gcs
  - low level API - similar to os package
- nats https://github.com/nats-io/nats.go/blob/main/object.go#L48
   - looks more like a kv store, there only list operation just lists all objects in storage: https://github.com/nats-io/nats.go/blob/main/object.go#L96
   - experimental preview


## next steps

The `gocloud.dev/blob` package looks by far the most promising. 
- wrap `gocloud.dev/blob` interface with our own
- implement SQL backend, either 
   - implement [Driver](https://github.com/google/go-cloud/blob/master/blob/driver/driver.go) interface and reuse their test harness
   - create a parallel implementation
