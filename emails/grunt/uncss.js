module.exports = {
    dist: {
        src: ['templates/*.html'],
        dest: 'dist/css/tidy.css',
        options: {
            report: 'min' // optional: include to report savings
        }
    }
};
