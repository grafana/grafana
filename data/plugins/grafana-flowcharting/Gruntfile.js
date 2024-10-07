const path = require("path");
const sass = require('node-sass');
// const plugin = require('./src/plugin.js');
const version = "0.5.0";

module.exports = (grunt) => {
  require('load-grunt-tasks')(grunt);

  grunt.loadNpmTasks('grunt-git');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-sass');
  grunt.loadNpmTasks('grunt-contrib-compress');

  grunt.initConfig({

    clean: {
      before_init: {
        src: ['externals/**/*'],
      },
      build: {
        src: ['dist/**/*'],
      },
      after_init: {
        src: ['externals/**/.git'],
      },
    },

    copy: {
      sanitizer_to_src:  {
        cwd: 'externals/drawio/src/main/webapp/js/sanitizer',
        expand: true,
        src: ['sanitizer.min.js'],
        dest: 'src/libs',
      },
      shapes_to_src:  {
        cwd: 'externals/drawio/src/main/webapp/shapes',
        expand: true,
        src: ['**/*.js'],
        dest: 'src/libs/shapes',
      },      
      src_to_dist: {
        cwd: 'src',
        expand: true,
        src: ['**/*', '!**/*.js', '!**/*.scss', '!img/**/*', '.*', '!__mocks__'],
        dest: 'dist',
      },
      vkbeautify_to_dist: {
        cwd: 'node_modules',
        expand: true,
        src: ['vkbeautify/index.js'],
        dest: 'dist/libs',
      },
      libs_to_dist: {
        cwd: 'node_modules',
        expand: true,
        src: ['mxgraph/javascript/dist/**/*', '!**/*.js'],
        dest: 'dist/libs',
      },
      res_to_dist: {
        cwd: 'node_modules/mxgraph/javascript/src',
        expand: true,
        src: ['**/*', '!**/*.js'],
        dest: 'dist/libs/mxgraph/javascript/dist',
      },
      mxgraph_to_dist: {
        cwd: 'externals/mxgraph/javascript/examples/grapheditor/www',
        expand: true,
        src: ['**/*', '!**/*.js'],
        dest: 'dist/libs/mxgraph/javascript/dist',
      },
      chartist_to_dist: {
        cwd: 'node_modules/chartist/dist/chartist.min.js',
        expand: true,
        src: ['**/*', '!**/*.js'],
        dest: 'dist/chartist',
      },


      readme: {
        expand: true,
        src: ['README.md'],
        dest: 'dist',
      },

      img_to_dist: {
        cwd: 'src',
        expand: true,
        src: ['img/**/*'],
        dest: 'dist/',
      },

      drawio_img_to_dist: {
        cwd: 'externals/drawio/src/main/webapp',
        expand: true,
        src: ['img/**/*'],
        dest: 'dist/',
      },

      stencils_to_dist: {
        cwd: 'externals/drawio/src/main/webapp/stencils',
        expand: true,
        src: ['**/*', '!**/*.js'],
        dest: 'dist/libs/mxgraph/javascript/dist/stencils',
      },
    },

    watch: {
      rebuild_all: {
        files: ['src/**/*', 'README.md'],
        tasks: ['default'],
        options: {
          spawn: false,
        },
      },
      microbuild: {
        files: ['src/**/*'],
        tasks: ['microbuild'],
        options: {
          spawn: false,
        },
      },
    },


    sass: {
      options: {
        sourceMap: false,
        implementation: sass,
      },
      dist: {
        files: {
          'dist/css/chartist-settings.css': 'src/css/_chartist-settings.scss',
          'dist/css/flowchart.dark.css': 'src/css/flowchart.dark.scss',
          'dist/css/flowchart.light.css': 'src/css/flowchart.light.scss',
        },
      },
    },
    babel: {
      options: {
        sourceMap: false,
      },
      dist: {
        files: [{
          cwd: 'src',
          expand: true,
          src: ['**/*.js', '!mxHandler.js', "!Graph.js", "!init.js", "!utils.js", "!backup/**/*", "!__mocks__", "!libs/sanitizer.min.js"],
          dest: 'dist',
          ext: '.js',
        }],
      },
    },

    webpack: {
      mxgraph: {
        entry: "./src/graph_class.js",
        mode: "development",
        module: {
          rules: [
            {
              test: /\.m?js$/,
              exclude: /(node_modules|bower_components|externals)/,
              use: {
                loader: 'babel-loader',
              },
            },
          ],
        },
        output: {
          path: path.resolve(process.cwd(), "./dist"),
          filename: "graph_class.js",
          library: "graph_class",
          libraryTarget: "umd",
        },
        externals: {
          jquery: "jquery",
          lodash: "lodash",
        },
      },
      utils: {
        entry: "./src/utils.js",
        mode: "development",
        module: {
          rules: [
            {
              test: /\.m?js$/,
              exclude: /(node_modules|bower_components|externals)/,
              use: {
                loader: 'babel-loader',
              },
            },
          ],
        },
        output: {
          path: path.resolve(process.cwd(), "./dist"),
          filename: "utils.js",
          library: "utils",
          libraryTarget: "umd",
        },
        externals: {
          jquery: "jquery",
          lodash: "lodash",
        },
      },
      tooltip: {
        entry: "./src/tooltipHandler.js",
        mode: "development",
        module: {
          rules: [
            {
              test: /\.m?js$/,
              exclude: /(node_modules|bower_components|externals)/,
              use: {
                loader: 'babel-loader',
              },
            },
          ],
        },
        output: {
          path: path.resolve(process.cwd(), "./dist"),
          filename: "tooltipHandler.js",
          library: "tooltipHandler",
          libraryTarget: "umd",
        },
        externals: {
          jquery: "jquery",
          lodash: "lodash",
        },
      },
    },

    compress: {
      main: {
        options: {
          archive: "archives/agenty-flowcharting-panel-" + version + "-SNAPSHOT.zip",
        },
        expand: true,
        cwd: '.',
        src: ['**/*', '!node_modules/**', '!bower_components/**', '!others/**', '!.git/**', '!archives/**', '!public/**', '!backup/**', '!spec/**', '!spec/__snapshots__/**','!externals/**'],
        dest: 'grafana-flowcharting',
      },
    },

    gitclone: {
      mxgraph: {
        options: {
          repository: 'https://github.com/jgraph/mxgraph',
          branch: 'master',
          depth: 1,
          tags: "v4.0.4",
          directory: 'externals/mxgraph',
          verbose: true,
        }
      },
      drawio: {
        options: {
            repository: 'https://github.com/jgraph/drawio',
            branch: 'master',
            depth: 1,
            tags : "v11.2.8",
            directory: 'externals/drawio',
            verbose: true,
        }
      }
    },

  });

  grunt.registerTask('default', ['clean:build', 'copy:src_to_dist', 'sass', 'copy:readme', 'copy:img_to_dist', 'babel', 'webpack', 'copy:res_to_dist', 'copy:mxgraph_to_dist', 'copy:stencils_to_dist']);
  grunt.registerTask('microbuild', ['sass', 'babel', 'webpack' ]);
  grunt.registerTask('dev', ['default', 'watch:rebuild_all']);
  grunt.registerTask('microdev', ['microbuild', 'watch:microbuild']);
  grunt.registerTask('archive', ['default', 'compress:main']);
  grunt.registerTask('init', ['clean:before_init','gitclone:mxgraph','gitclone:drawio','clean:after_init']);
};
