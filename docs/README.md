# Building the docs locally

## Requirements

Docker >= 2.1.0.3

## Getting Started

To build the docs locally:

1. Make sure you are in the docs folder: `cd docs`.
2. Run `make build`. This builds the docker image with the correct version of Hugo.
3. Run `make run`. This runs the container. It will start a hugo sever, and you can naviagate to the site in your browser at `localhost:1313`. 

You can then edit files in the `sources` directory which will update `localhost:1313` when changes are saved.

## Content Guidelines

### Using `relref` for internal links

Coming soon.

## Adding Images

Coming soon.