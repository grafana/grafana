
# TODO

## decisions

1. naming:
   - folder + file 
   - container + item
   - bucket + object
2. delimiter: accept only `/`

## describe API

The API needs to be limited to the minimum set of functionalities we can support for all backends: SQL & cloud object storage services (GCS)
We need at least:

- get/delete/upsert file
- list files
   - pagination
   - stable order so we can use a cursor 
   - recursive + just folder listing
- list folders
   - no pagination
   - only recursive
- create/delete folders


## list libs

- stow https://github.com/graymeta/stow
- storage https://github.com/trusch/storage
- cloud development kit blob https://gocloud.dev/howto/blob/ 
- dosa https://github.com/uber-go/dosa
- gost https://github.com/usmanhalalit/gost
- cloudstorage https://github.com/lytics/cloudstorage
- afero https://github.com/spf13/afero
- rclone https://github.com/rclone/rclone

## compare libs
