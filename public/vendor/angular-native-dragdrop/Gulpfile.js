/* jshint -W097 */
'use strict';

/* global require */
var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var gulp = require('gulp');

gulp.task('lint', function() {
    return gulp.src('./draganddrop.js')
        .pipe(jshint())
        .pipe(jshint.reporter(stylish));
});
gulp.task('compress', function() {
    return gulp.src('./draganddrop.js')
        .pipe(uglify())
        .pipe(rename({
            extname: '.min.js'
        }))
        .pipe(gulp.dest('./'));
});

gulp.task('default', ['lint', 'compress']);
