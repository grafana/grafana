version = "0.1"

error "shorturl.badRequest" {
  message = "Bad request"
  cause = "BadRequest"
}

error "shorturl.notFound" {
  message = "Could not find the specified short URL"
  cause = "NotFound"
}

error "shorturl.absolutePath" {
  message = "Path should be relative"
  cause = "ValidationFailed"
  guide = "Try removing any prefixing `/` to your path."
}

error "shorturl.invalidPath" {
  message = "Invalid short URL path"
  cause = "ValidationFailed"
  guide = <<EOF
There is something wrong with the path you've submitted. It might
contain unsupported characters or path-components .. to move up in the
hierarchy, which is not supported by the shorturl service.
  EOF
}

error "shorturl.internal" {
  message = "Internal server error"
  cause = "Internal"
}
