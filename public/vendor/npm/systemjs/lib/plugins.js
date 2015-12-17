/*
  SystemJS Loader Plugin Support

  Supports plugin loader syntax with "!", or via metadata.loader

  The plugin name is loaded as a module itself, and can override standard loader hooks
  for the plugin resource. See the plugin section of the systemjs readme.
*/
(function() {

  // sync or async plugin normalize function
  function normalizePlugin(normalize, name, parentName, isPlugin, sync) {
    var loader = this;
    // if parent is a plugin, normalize against the parent plugin argument only
    if (parentName) {
      var parentPluginIndex;
      if (loader.pluginFirst) {
        if ((parentPluginIndex = parentName.lastIndexOf('!')) != -1)
          parentName = parentName.substr(parentPluginIndex + 1);
      }
      else {
        if ((parentPluginIndex = parentName.indexOf('!')) != -1)
          parentName = parentName.substr(0, parentPluginIndex);
      }
    }

    // if this is a plugin, normalize the plugin name and the argument
    var pluginIndex = name.lastIndexOf('!');
    if (pluginIndex != -1) {
      var argumentName;
      var pluginName;

      if (loader.pluginFirst) {
        argumentName = name.substr(pluginIndex + 1);
        pluginName = name.substr(0, pluginIndex);
      }
      else {
        argumentName = name.substr(0, pluginIndex);
        pluginName = name.substr(pluginIndex + 1) || argumentName.substr(argumentName.lastIndexOf('.') + 1);
      }

      // note if normalize will add a default js extension
      // if so, remove for backwards compat
      // this is strange and sucks, but will be deprecated
      var defaultExtension = loader.defaultJSExtensions && argumentName.substr(argumentName.length - 3, 3) != '.js';

      // put name back together after parts have been normalized
      function normalizePluginParts(argumentName, pluginName) {
        if (defaultExtension && argumentName.substr(argumentName.length - 3, 3) == '.js')
          argumentName = argumentName.substr(0, argumentName.length - 3);

        if (loader.pluginFirst) {
          return pluginName + '!' + argumentName;
        }
        else {
          return argumentName + '!' + pluginName;
        }
      }

      if (sync) {
        argumentName = loader.normalizeSync(argumentName, parentName);
        pluginName = loader.normalizeSync(pluginName, parentName);

        return normalizePluginParts(argumentName, pluginName);
      }
      else {
        // third argument represents that this is a plugin call
        // which in turn will skip default extension adding within packages
        return Promise.all([
          loader.normalize(argumentName, parentName, true),
          loader.normalize(pluginName, parentName, true)
        ])
        .then(function(normalized) {
          return normalizePluginParts(normalized[0], normalized[1]);
        });
      }
    }
    else {
      return normalize.call(loader, name, parentName, isPlugin);
    }
  }

  // async plugin normalize
  hook('normalize', function(normalize) {
    return function(name, parentName, isPlugin) {
      return normalizePlugin.call(this, normalize, name, parentName, isPlugin, false);
    };
  });

  hook('normalizeSync', function(normalizeSync) {
    return function(name, parentName, isPlugin) {
      return normalizePlugin.call(this, normalizeSync, name, parentName, isPlugin, true);
    };
  });

  hook('locate', function(locate) {
    return function(load) {
      var loader = this;

      var name = load.name;

      // plugin syntax
      var pluginSyntaxIndex;
      if (loader.pluginFirst) {
        if ((pluginSyntaxIndex = name.indexOf('!')) != -1) {
          load.metadata.loader = name.substr(0, pluginSyntaxIndex);
          load.name = name.substr(pluginSyntaxIndex + 1);
        }
      }
      else {
        if ((pluginSyntaxIndex = name.lastIndexOf('!')) != -1) {
          load.metadata.loader = name.substr(pluginSyntaxIndex + 1);
          load.name = name.substr(0, pluginSyntaxIndex);
        }
      }

      return locate.call(loader, load)
      .then(function(address) {
        var plugin = load.metadata.loader;

        if (!plugin)
          return address;

        // only fetch the plugin itself if this name isn't defined
        if (loader.defined && loader.defined[name])
          return address;

        var pluginLoader = loader.pluginLoader || loader;

        // load the plugin module and run standard locate
        return pluginLoader['import'](plugin)
        .then(function(loaderModule) {
          // store the plugin module itself on the metadata
          load.metadata.loaderModule = loaderModule;

          load.address = address;
          if (loaderModule.locate)
            return loaderModule.locate.call(loader, load);

          return address;
        });
      });
    };
  });

  hook('fetch', function(fetch) {
    return function(load) {
      var loader = this;
      if (load.metadata.loaderModule && load.metadata.loaderModule.fetch) {
        load.metadata.scriptLoad = false;
        return load.metadata.loaderModule.fetch.call(loader, load, function(load) {
          return fetch.call(loader, load);
        });
      }
      else {
        return fetch.call(loader, load);
      }
    };
  });

  hook('translate', function(translate) {
    return function(load) {
      var loader = this;
      if (load.metadata.loaderModule && load.metadata.loaderModule.translate)
        return Promise.resolve(load.metadata.loaderModule.translate.call(loader, load)).then(function(result) {
          if (typeof result == 'string')
            load.source = result;
          return translate.call(loader, load);
        });
      else
        return translate.call(loader, load);
    };
  });

  hook('instantiate', function(instantiate) {
    return function(load) {
      var loader = this;

      /*
       * Source map sanitization for load.metadata.sourceMap
       * Used to set browser and build-level source maps for
       * translated sources in a general way.
       */
      var sourceMap = load.metadata.sourceMap;

      // if an object not a JSON string do sanitizing
      if (sourceMap && typeof sourceMap == 'object') {
        var originalName = load.name.split('!')[0];

        // force set the filename of the original file
        sourceMap.file = originalName + '!transpiled';

        // force set the sources list if only one source
        if (!sourceMap.sources || sourceMap.sources.length == 1)
          sourceMap.sources = [originalName];
        load.metadata.sourceMap = JSON.stringify(sourceMap);
      }

      if (load.metadata.loaderModule && load.metadata.loaderModule.instantiate)
        return Promise.resolve(load.metadata.loaderModule.instantiate.call(loader, load)).then(function(result) {
          load.metadata.entry = createEntry();
          load.metadata.entry.execute = function() {
            return result;
          }
          load.metadata.entry.deps = load.metadata.deps;
          load.metadata.format = 'defined';
          return instantiate.call(loader, load);
        });
      else
        return instantiate.call(loader, load);
    };
  });

})();
