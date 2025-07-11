# Pa11y accessability tests

We use pa11y to run some automated simple accessability tests. They're ran with dagger to help orchestrate starting server + tests in a reproducable manner.

To run the tests locally:

1. Install dagger locally https://docs.dagger.io/install/
2. Grab the grafana.tar.gz artifact by either
   1. Downloading it from the Github Action artifact from your PR
   1. Build it locally with:
      ```sh
      dagger run go run ./pkg/build/cmd artifacts -a targz:grafana:linux/amd64 --grafana-dir="$PWD" > dist/files.txt
      cat dist/files.txt # Will output the path to the grafana.tar.gz 
      ```
3. Run the dagger pipeline with:
   ```sh
   dagger -v run go run ./pkg/build/a11y --package=(full path to .tar.gz) --results=./pa11y-ci-results.json
   ```
   The JSON results file will be saved to the file from the `--results` arg 
4. If they fail and you want to see the full output
   1. Run the dagger command with `dagger -vE [...]`
   2. At the end, arrow up to the exec pa11y-ci segment and hit Enter