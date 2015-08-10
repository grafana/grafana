module.exports = {
    dist: {
        src: ['dist/*.html'],
        dest: 'dist/css/tidy.css',
        options: {
            report: 'min' // optional: include to report savings
        }
    }
};
