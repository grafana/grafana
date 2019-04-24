# Repository updates deb/rpm



## Testing

It's possible to test the repo updates for rpm and deb by running the test scripts within a docker container like this. Tests are being executed by using two buckets on gcp setup for testing.

```bash
docker run -ti --rm -u 0:0 grafana/grafana-ci-deploy:1.2.0 bash # 1.2.0 is the newest image at the time of writing
# in the container:
mkdir -p /go/src/github.com/grafana/dist
cd /go/src/github.com/grafana

#outside of container:
cd <grafana project dir>/..
docker cp grafana <container_name>:/go/src/github.com/grafana/.
docker cp <gpg.key used for signing> <container_name>:/private.key

#in container:
gpg --batch --allow-secret-key-import --import /private.key
cd dist && wget https://dl.grafana.com/oss/release/grafana_5.4.3_amd64.deb && wget https://dl.grafana.com/oss/release/grafana-5.4.3-1.x86_64.rpm && cd ..

#run these scripts:
./script/build/update_repo/test-update-deb-repo.sh <gpg key password>
./script/build/update_repo/test-update-rpm-repo.sh <gpg key password>

```
