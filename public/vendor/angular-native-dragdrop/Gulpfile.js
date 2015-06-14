/* jshint -W097 */
'use strict';

/* global require */
var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
var gulp = require('gulp');

gulp.task('lint', function() {
    return gulp.src('./draganddrop.js')
        .pipe(jshint())
        .pipe(jshint.reporter(stylish));
});

gulp.task('default', ['lint']);
