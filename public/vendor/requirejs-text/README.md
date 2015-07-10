# text

A [RequireJS](http://requirejs.org)/AMD loader plugin for loading text
resources.

Known to work in RequireJS, but should work in other AMD loaders that support
the same loader plugin API.

## Docs

See the [RequireJS API text section](http://requirejs.org/docs/api.html#text).

## Latest release

The latest release is always available from [the "latest" tag](https://raw.github.com/requirejs/text/latest/text.js).

It can also be installed using [volo](https://github.com/volojs/volo):

    volo add requirejs/text

## Usage

It is nice to build HTML using regular HTML tags, instead of building up DOM
structures in script. However, there is no good way to embed HTML in a
JavaScript file. The best that can be done is using a string of HTML, but that
can be hard to manage, particularly for multi-line HTML.

The text.js AMD loader plugin can help with this issue. It will automatically be
loaded if the text! prefix is used for a dependency. Download the plugin and put
it in the app's [baseUrl](http://requirejs.org/docs/api.html#config-baseUrl)
directory (or use the [paths config](http://requirejs.org/docs/api.html#config-paths) to place it in other areas).

You can specify a text file resource as a dependency like so:

```javascript
require(["some/module", "text!some/module.html", "text!some/module.css"],
    function(module, html, css) {
        //the html variable will be the text
        //of the some/module.html file
        //the css variable will be the text
        //of the some/module.css file.
    }
);
```

Notice the .html and .css suffixes to specify the extension of the file. The
"some/module" part of the path will be resolved according to normal module name
resolution: it will use the **baseUrl** and **paths** [configuration
options](http://requirejs.org/docs/api.html#config) to map that name to a path.

For HTML/XML/SVG files, there is another option. You can pass !strip, which
strips XML declarations so that external SVG and XML documents can be added to a
document without worry. Also, if the string is an HTML document, only the part
inside the body tag is returned. Example:

```javascript
require(["text!some/module.html!strip"],
    function(html) {
        //the html variable will be the text of the
        //some/module.html file, but only the part
        //inside the body tag.
    }
);
```

The text files are loaded via asynchronous XMLHttpRequest (XHR) calls, so you
can only fetch files from the same domain as the web page (see **XHR
restrictions** below).

However, [the RequireJS optimizer](http://requirejs.org/docs/optimization.html)
will inline any text! references with the actual text file contents into the
modules, so after a build, the modules that have text! dependencies can be used
from other domains.

## Configuration

### XHR restrictions

The text plugin works by using XMLHttpRequest (XHR) to fetch the text for the
resources it handles.

However, XHR calls have some restrictions, due to browser/web security policies:

1) Many browsers do not allow file:// access to just any file. You are better
off serving the application from a local web server than using local file://
URLs. You will likely run into trouble otherwise.

2) There are restrictions for using XHR to access files on another web domain.
While CORS can help enable the server for cross-domain access, doing so must
be done with care (in particular if you also host an API from that domain),
and not all browsers support CORS.

So if the text plugin determines that the request for the resource is on another
domain, it will try to access a ".js" version of the resource by using a
script tag. Script tag GET requests are allowed across domains. The .js version
of the resource should just be a script with a define() call in it that returns
a string for the module value.

Example: if the resource is 'text!example.html' and that resolves to a path
on another web domain, the text plugin will do a script tag load for
'example.html.js'.

The [requirejs optimizer](http://requirejs.org/docs/optimization.html) will
generate these '.js' versions of the text resources if you set this in the
build profile:

    optimizeAllPluginResources: true

In some cases, you may want the text plugin to not try the .js resource, maybe
because you have configured CORS on the other server, and you know that only
browsers that support CORS will be used. In that case you can use the
[module config](http://requirejs.org/docs/api.html#config-moduleconfig)
(requires RequireJS 2+) to override some of the basic logic the plugin uses to
determine if the .js file should be requested:

```javascript
requirejs.config({
    config: {
        text: {
            useXhr: function (url, protocol, hostname, port) {
                //Override function for determining if XHR should be used.
                //url: the URL being requested
                //protocol: protocol of page text.js is running on
                //hostname: hostname of page text.js is running on
                //port: port of page text.js is running on
                //Use protocol, hostname, and port to compare against the url
                //being requested.
                //Return true or false. true means "use xhr", false means
                //"fetch the .js version of this resource".
            }
        }
    }
});
```

### Custom XHR hooks

There may be cases where you might want to provide the XHR object to use
in the request, or you may just want to add some custom headers to the
XHR object used to make the request. You can use the following hooks:

```javascript
requirejs.config({
    config: {
        text: {
            onXhr: function (xhr, url) {
                //Called after the XHR has been created and after the
                //xhr.open() call, but before the xhr.send() call.
                //Useful time to set headers.
                //xhr: the xhr object
                //url: the url that is being used with the xhr object.
            },
            createXhr: function () {
                //Overrides the creation of the XHR object. Return an XHR
                //object from this function.
                //Available in text.js 2.0.1 or later.
            },
            onXhrComplete: function (xhr, url) {
                //Called whenever an XHR has completed its work. Useful
                //if browser-specific xhr cleanup needs to be done.
            }
        }
    }
});
```

### Forcing the environment implemention

The text plugin tries to detect what environment it is available for loading
text resources, Node, XMLHttpRequest (XHR) or Rhino, but sometimes the
Node or Rhino environment may have loaded a library that introduces an XHR
implementation. You can force the environment implementation to use by passing
an "env" module config to the plugin:

```javascript
requirejs.config({
    config: {
        text: {
            //Valid values are 'node', 'xhr', or 'rhino'
            env: 'rhino'
        }
    }
});
```

## License

Dual-licensed -- new BSD or MIT.

## Where are the tests?

They are in the [requirejs](https://github.com/jrburke/requirejs) and
[r.js](https://github.com/jrburke/r.js) repos.

## History

This plugin was in the [requirejs repo](https://github.com/jrburke/requirejs)
up until the requirejs 2.0 release.
