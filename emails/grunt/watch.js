module.exports = {
    src: {
        files: [
            //what are the files that we want to watch
            'assets/css/*.css',
            '*.html'
        ],
        options: {
            nospawn: true,
            livereload: true,
        }
    }

};
