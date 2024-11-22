#!/usr/bin/env bash

echo "Deleting previous bulk folders"
find ./bulk-folders -type d -name "Bulk Folder*" -exec rm -rf "{}" \;

numberOfFolders=${1:-200}
numberOfDashboardsPerFolder=${2:-3}

for (( folderCounter=1; folderCounter<="$numberOfFolders"; folderCounter++ ))
do
   echo "Creating folder $folderCounter"
  folderPath="bulk-folders/Bulk Folder ${folderCounter}"

  mkdir -p "$folderPath"

  for (( dashCounter=1; dashCounter<="$numberOfDashboardsPerFolder"; dashCounter++ ))
  do
    jsonnet -o "$folderPath/dashboard${dashCounter}.json" -e "local bulkDash = import 'bulk-dashboards/bulkdash.jsonnet'; bulkDash + {  uid: 'bulk-folder-${folderCounter}-${dashCounter}',  title: 'Bulk Folder  ${folderCounter} Dashboard ${dashCounter}' }"
  done
done
