FROM grafana/docs-base:latest

# TODO: need the full repo source to get the git version info
COPY . /src

# Reset the /docs dir so we can replace the theme meta with the new repo's git info
RUN git reset --hard

# Then copy the desired docs into the /docs/sources/ dir
COPY ./sources/ /docs/sources

COPY ./VERSION /docs/VERSION

COPY ./changed-files /docs/changed-files

# adding the image spec will require Docker 1.5 and `docker build -f docs/Dockerfile .`
#COPY ./image/spec/v1.md /docs/sources/reference/image-spec-v1.md

# TODO: don't do this - look at merging the yml file in build.sh
COPY ./mkdocs.yml /docs/mkdocs.yml

COPY ./s3_website.json /docs/s3_website.json

# Then build everything together, ready for mkdocs
RUN /docs/build.sh
