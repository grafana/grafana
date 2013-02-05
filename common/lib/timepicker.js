/* =========================================================
 * bootstrap-timepicker.js
 * http://www.github.com/jdewit/bootstrap-timepicker
 * =========================================================
 * Copyright 2012
 *
 * Created By:
 * Joris de Wit @joris_dewit
 *
 * Contributions By:
 * Gilbert @mindeavor
 * Koen Punt info@koenpunt.nl
 * Nek
 * Chris Martin
 * Dominic Barnes contact@dominicbarnes.us
 * Olivier Louvignes @olouv
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================= */

!function($) {

    "use strict"; // jshint ;_;

    var isTouch = 'ontouchstart' in window;

    /* TIMEPICKER PUBLIC CLASS DEFINITION
     * ================================== */
    var Timepicker = function(element, options) {
        this.$element = $(element);
        this.options = $.extend({}, $.fn.timepicker.defaults, options, this.$element.data());
        this.minuteStep = this.options.minuteStep || this.minuteStep;
        this.secondStep = this.options.secondStep || this.secondStep;
        this.showMeridian = this.options.showMeridian || this.showMeridian;
        this.showSeconds = this.options.showSeconds || this.showSeconds;
        this.showInputs = this.options.showInputs || this.showInputs;
        this.disableFocus = this.options.disableFocus || this.disableFocus;
        this.template = this.options.template || this.template;
        this.modalBackdrop = this.options.modalBackdrop || this.modalBackdrop;
        this.defaultTime = this.options.defaultTime || this.defaultTime;
        this.open = false;
        this.init();
    };

    Timepicker.prototype = {

        constructor: Timepicker

        , init: function () {
            if (this.$element.parent().hasClass('input-append')) {
                this.$element.parent('.input-append').find('.add-on').on('click', $.proxy(this.showWidget, this));
                this.$element.on({
                    focus: $.proxy(this.highlightUnit, this),
                    click: $.proxy(this.highlightUnit, this),
                    keydown: $.proxy(this.elementKeydown, this),
                    blur: $.proxy(this.blurElement, this)
                });

            } else {
                if (this.template) {
                    this.$element.on({
                        focus: $.proxy(this.showWidget, this),
                        click: $.proxy(this.showWidget, this),
                        blur: $.proxy(this.blurElement, this)
                    });
                } else {
                    this.$element.on({
                        focus: $.proxy(this.highlightUnit, this),
                        click: $.proxy(this.highlightUnit, this),
                        keydown: $.proxy(this.elementKeydown, this),
                        blur: $.proxy(this.blurElement, this)
                    });
                }
            }


            this.$widget = $(this.getTemplate()).appendTo('body');

            this.$widget.on('click', $.proxy(this.widgetClick, this));

            if (this.showInputs) {
                this.$widget.find('input').on({
                    click: function() { this.select(); },
                    keydown: $.proxy(this.widgetKeydown, this),
                    change: $.proxy(this.updateFromWidgetInputs, this)
                });
            }

            this.setDefaultTime(this.defaultTime);
        }

        , showWidget: function(e) {
            e.stopPropagation();
            e.preventDefault();

            if (this.open) {
                return;
            }

            this.$element.trigger('show');

            if (isTouch || this.disableFocus) {
                this.$element.blur();
            }

            var pos = $.extend({}, this.$element.offset(), {
                height: this.$element[0].offsetHeight
            });

            this.updateFromElementVal();

            $('html')
                .one(isTouch ? 'touchstart.timepicker.data-api' : 'click.timepicker.data-api', $.proxy(this.hideWidget, this))
                .on(isTouch ? 'touchstart.timepicker.data-api' : 'click.timepicker.data-api', '.bootstrap-timepicker', function (e) { e.stopPropagation() });

            if (this.template === 'modal') {
                this.$widget.modal('show').on('hidden', $.proxy(this.hideWidget, this));
            } else {
                this.$widget.css({
                    top: pos.top + pos.height
                    , left: pos.left
                })

                if (!this.open) {
                    this.$widget.addClass('open');
                }
            }

            this.open = true;
            this.$element.trigger('shown');
        }

        , hideWidget: function(){
            this.$element.trigger('hide');

            if (this.template === 'modal') {
                this.$widget.modal('hide');
            } else {
                this.$widget.removeClass('open');
            }
            this.open = false;
            this.$element.trigger('hidden');
        }

        , widgetClick: function(e) {
            e.stopPropagation();
            e.preventDefault();

            var action = $(e.target).closest('a').data('action');
            if (action) {
                this[action]();
                this.update();
            }
        }

        , widgetKeydown: function(e) {
            var input = $(e.target).closest('input').attr('name');

            switch (e.keyCode) {
                case 9: //tab
                    if (this.showMeridian) {
                        if (input == 'meridian') {
                            this.hideWidget();
                        }
                    } else {
                        if (this.showSeconds) {
                            if (input == 'second') {
                                this.hideWidget();
                            }
                        } else {
                            if (input == 'minute') {
                                this.hideWidget();
                            }
                        }
                    }
                break;
                case 27: // escape
                    this.hideWidget();
                break;
                case 38: // up arrow
                    switch (input) {
                        case 'hour':
                            this.incrementHour();
                        break;
                        case 'minute':
                            this.incrementMinute();
                        break;
                        case 'second':
                            this.incrementSecond();
                        break;
                        case 'meridian':
                            this.toggleMeridian();
                        break;
                    }
                    this.update();
                break;
                case 40: // down arrow
                    switch (input) {
                        case 'hour':
                            this.decrementHour();
                        break;
                        case 'minute':
                            this.decrementMinute();
                        break;
                        case 'second':
                            this.decrementSecond();
                        break;
                        case 'meridian':
                            this.toggleMeridian();
                        break;
                    }
                    this.update();
                break;
            }
        }

        , elementKeydown: function(e) {
            var input = this.$element.get(0);
            switch (e.keyCode) {
                case 0: //input
                break;
                case 9: //tab
                    this.updateFromElementVal();
                    if (this.showMeridian) {
                        if (this.highlightedUnit != 'meridian') {
                            e.preventDefault();
                            this.highlightNextUnit();
                        }
                    } else {
                        if (this.showSeconds) {
                            if (this.highlightedUnit != 'second') {
                                e.preventDefault();
                                this.highlightNextUnit();
                            }
                        } else {
                            if (this.highlightedUnit != 'minute') {
                                e.preventDefault();
                                this.highlightNextUnit();
                            }
                        }
                    }
                break;
                case 27: // escape
                    this.updateFromElementVal();
                break;
                case 37: // left arrow
                    this.updateFromElementVal();
                    this.highlightPrevUnit();
                break;
                case 38: // up arrow
                    switch (this.highlightedUnit) {
                        case 'hour':
                            this.incrementHour();
                        break;
                        case 'minute':
                            this.incrementMinute();
                        break;
                        case 'second':
                            this.incrementSecond();
                        break;
                        case 'meridian':
                            this.toggleMeridian();
                        break;
                    }
                    this.updateElement();
                break;
                case 39: // right arrow
                    this.updateFromElementVal();
                    this.highlightNextUnit();
                break;
                case 40: // down arrow
                    switch (this.highlightedUnit) {
                        case 'hour':
                            this.decrementHour();
                        break;
                        case 'minute':
                            this.decrementMinute();
                        break;
                        case 'second':
                            this.decrementSecond();
                        break;
                        case 'meridian':
                            this.toggleMeridian();
                        break;
                    }
                    this.updateElement();
                break;
            }

            if (e.keyCode !== 0 && e.keyCode !== 8 && e.keyCode !== 9 && e.keyCode !== 46) {
                e.preventDefault();
            }
        }

        , setValues: function(time) {
            if (this.showMeridian) {
                var arr = time.split(' ');
                var timeArray = arr[0].split(':');
                this.meridian = arr[1];
            } else {
                var timeArray = time.split(':');
            }

            this.hour = parseInt(timeArray[0], 10);
            this.minute = parseInt(timeArray[1], 10);
            this.second = parseInt(timeArray[2], 10);

            if (isNaN(this.hour)) {
                this.hour = 0;
            }
            if (isNaN(this.minute)) {
                this.minute = 0;
            }

            if (this.showMeridian) {
                if (this.hour > 12) {
                    this.hour = 12;
                } else if (this.hour < 1) {
                    this.hour = 1;
                }

                if (this.meridian == 'am' || this.meridian == 'a') {
                    this.meridian = 'AM';
                } else if (this.meridian == 'pm' || this.meridian == 'p') {
                    this.meridian = 'PM';
                }

                if (this.meridian != 'AM' && this.meridian != 'PM') {
                    this.meridian = 'AM';
                }
            } else {
                 if (this.hour >= 24) {
                    this.hour = 23;
                } else if (this.hour < 0) {
                    this.hour = 0;
                }
            }

            if (this.minute < 0) {
                this.minute = 0;
            } else if (this.minute >= 60) {
                this.minute = 59;
            }

            if (this.showSeconds) {
                if (isNaN(this.second)) {
                    this.second = 0;
                } else if (this.second < 0) {
                    this.second = 0;
                } else if (this.second >= 60) {
                    this.second = 59;
                }
            }

            if ( this.$element.val() != '' )
                this.updateElement();
            this.updateWidget();
        }

        , setMeridian: function(meridian) {
            if (meridian == 'a' || meridian == 'am' || meridian == 'AM' ) {
                this.meridian = 'AM';
            } else if (meridian == 'p' || meridian == 'pm' || meridian == 'PM' ) {
                this.meridian = 'PM';
            } else {
                this.updateWidget();
            }

            this.updateElement();
        }

        , setDefaultTime: function(defaultTime){
            if (defaultTime) {
                if (defaultTime === 'current') {
                    var dTime = new Date();
                    var hours = dTime.getHours();
                    var minutes = Math.floor(dTime.getMinutes() / this.minuteStep) * this.minuteStep;
                    var seconds = Math.floor(dTime.getSeconds() / this.secondStep) * this.secondStep;
                    var meridian = "AM";
                    if (this.showMeridian) {
                        if (hours === 0) {
                            hours = 12;
                        } else if (hours >= 12) {
                            if (hours > 12) {
                                hours = hours - 12;
                            }
                            meridian = "PM";
                        } else {
                           meridian = "AM";
                        }
                    }
                    this.hour = hours;
                    this.minute = minutes;
                    this.second = seconds;
                    this.meridian = meridian;
                } else if (defaultTime === 'value') {
                    this.setValues(this.$element.val());
                } else {
                    this.setValues(defaultTime);
                }
                if ( this.$element.val() != '' )
                    this.updateElement();
                this.updateWidget();
            } else {
                this.hour = 0;
                this.minute = 0;
                this.second = 0;
            }
        }

        , formatTime: function(hour, minute, second, meridian) {
            hour = hour < 10 ? '0' + hour : hour;
            minute = minute < 10 ? '0' + minute : minute;
            second = second < 10 ? '0' + second : second;

            return hour + ':' + minute + (this.showSeconds ? ':' + second : '') + (this.showMeridian ? ' ' + meridian : '');
        }

        , getTime: function() {
            return this.formatTime(this.hour, this.minute, this.second, this.meridian);
        }

        , setTime: function(time) {
            this.setValues(time);
            this.update();
        }

        , update: function() {
            this.updateElement();
            this.updateWidget();
        }

        , blurElement: function() {
          this.highlightedUnit = undefined;
          this.updateFromElementVal();
        }

        , updateElement: function() {
            var time = this.getTime();

            this.$element.val(time).change();

            switch (this.highlightedUnit) {
                case 'hour':
                    this.highlightHour();
                break;
                case 'minute':
                    this.highlightMinute();
                break;
                case 'second':
                    this.highlightSecond();
                break;
                case 'meridian':
                    this.highlightMeridian();
                break;
            }
        }

        , updateWidget: function() {
            if (this.showInputs) {
                this.$widget.find('input.bootstrap-timepicker-hour').val(this.hour < 10 ? '0' + this.hour : this.hour);
                this.$widget.find('input.bootstrap-timepicker-minute').val(this.minute < 10 ? '0' + this.minute : this.minute);
                if (this.showSeconds) {
                    this.$widget.find('input.bootstrap-timepicker-second').val(this.second < 10 ? '0' + this.second : this.second);
                }
                if (this.showMeridian) {
                    this.$widget.find('input.bootstrap-timepicker-meridian').val(this.meridian);
                }
            } else {
                this.$widget.find('span.bootstrap-timepicker-hour').text(this.hour);
                this.$widget.find('span.bootstrap-timepicker-minute').text(this.minute < 10 ? '0' + this.minute : this.minute);
                if (this.showSeconds) {
                    this.$widget.find('span.bootstrap-timepicker-second').text(this.second < 10 ? '0' + this.second : this.second);
                }
                if (this.showMeridian) {
                    this.$widget.find('span.bootstrap-timepicker-meridian').text(this.meridian);
                }
            }
        }

        , updateFromElementVal: function (e) {
            var time = this.$element.val();
            if (time) {
                this.setValues(time);
                this.updateWidget();
            }
        }

        , updateFromWidgetInputs: function () {
            var time = $('input.bootstrap-timepicker-hour', this.$widget).val() + ':' +
                       $('input.bootstrap-timepicker-minute', this.$widget).val() +
                       (this.showSeconds ?
                           ':' + $('input.bootstrap-timepicker-second', this.$widget).val()
                        : '') +
                       (this.showMeridian ?
                           ' ' + $('input.bootstrap-timepicker-meridian', this.$widget).val()
                        : '');

            this.setValues(time);
        }

        , getCursorPosition: function() {
            var input = this.$element.get(0);

            if ('selectionStart' in input) {
                // Standard-compliant browsers
                return input.selectionStart;
            } else if (document.selection) {
                // IE fix
                input.focus();
                var sel = document.selection.createRange();
                var selLen = document.selection.createRange().text.length;
                sel.moveStart('character', - input.value.length);

                return sel.text.length - selLen;
            }
        }

        , highlightUnit: function () {
            var input = this.$element.get(0);

            this.position = this.getCursorPosition();
            if (this.position >= 0 && this.position <= 2) {
                this.highlightHour();
            } else if (this.position >= 3 && this.position <= 5) {
                this.highlightMinute();
            } else if (this.position >= 6 && this.position <= 8) {
                if (this.showSeconds) {
                    this.highlightSecond();
                } else {
                    this.highlightMeridian();
                }
            } else if (this.position >= 9 && this.position <= 11) {
                this.highlightMeridian();
            }
        }

        , highlightNextUnit: function() {
            switch (this.highlightedUnit) {
                case 'hour':
                    this.highlightMinute();
                break;
                case 'minute':
                    if (this.showSeconds) {
                        this.highlightSecond();
                    } else {
                        this.highlightMeridian();
                    }
                break;
                case 'second':
                    this.highlightMeridian();
                break;
                case 'meridian':
                    this.highlightHour();
                break;
            }
        }

        , highlightPrevUnit: function() {
            switch (this.highlightedUnit) {
                case 'hour':
                    this.highlightMeridian();
                break;
                case 'minute':
                    this.highlightHour();
                break;
                case 'second':
                    this.highlightMinute();
                break;
                case 'meridian':
                    if (this.showSeconds) {
                        this.highlightSecond();
                    } else {
                        this.highlightMinute();
                    }
                break;
            }
        }

        , highlightHour: function() {
            this.highlightedUnit = 'hour';
            this.$element.get(0).setSelectionRange(0,2);
        }

        , highlightMinute: function() {
            this.highlightedUnit = 'minute';
            this.$element.get(0).setSelectionRange(3,5);
        }

        , highlightSecond: function() {
            this.highlightedUnit = 'second';
            this.$element.get(0).setSelectionRange(6,8);
        }

        , highlightMeridian: function() {
            this.highlightedUnit = 'meridian';
            if (this.showSeconds) {
                this.$element.get(0).setSelectionRange(9,11);
            } else {
                this.$element.get(0).setSelectionRange(6,8);
            }
        }

        , incrementHour: function() {
            if (this.showMeridian) {
                if (this.hour === 11) {
                    this.toggleMeridian();
                } else if (this.hour === 12) {
                    return this.hour = 1;
                }
            }
            if (this.hour === 23) {
                return this.hour = 0;
            }
            this.hour = this.hour + 1;
        }

        , decrementHour: function() {
            if (this.showMeridian) {
                if (this.hour === 1) {
                    return this.hour = 12;
                }
                else if (this.hour === 12) {
                    this.toggleMeridian();
                }
            }
            if (this.hour === 0) {
                return this.hour = 23;
            }
            this.hour = this.hour - 1;
        }

        , incrementMinute: function() {
            var newVal = this.minute + this.minuteStep - (this.minute % this.minuteStep);
            if (newVal > 59) {
                this.incrementHour();
                this.minute = newVal - 60;
            } else {
                this.minute = newVal;
            }
        }

        , decrementMinute: function() {
            var newVal = this.minute - this.minuteStep;
            if (newVal < 0) {
                this.decrementHour();
                this.minute = newVal + 60;
            } else {
                this.minute = newVal;
            }
        }

        , incrementSecond: function() {
            var newVal = this.second + this.secondStep - (this.second % this.secondStep);
            if (newVal > 59) {
                this.incrementMinute();
                this.second = newVal - 60;
            } else {
                this.second = newVal;
            }
        }

        , decrementSecond: function() {
            var newVal = this.second - this.secondStep;
            if (newVal < 0) {
                this.decrementMinute();
                this.second = newVal + 60;
            } else {
                this.second = newVal;
            }
        }

        , toggleMeridian: function() {
            this.meridian = this.meridian === 'AM' ? 'PM' : 'AM';

            this.update();
        }

        , getTemplate: function() {
            if (this.options.templates[this.options.template]) {
                return this.options.templates[this.options.template];
            }
            if (this.showInputs) {
                var hourTemplate = '<input type="text" name="hour" class="bootstrap-timepicker-hour" maxlength="2"/>';
                var minuteTemplate = '<input type="text" name="minute" class="bootstrap-timepicker-minute" maxlength="2"/>';
                var secondTemplate = '<input type="text" name="second" class="bootstrap-timepicker-second" maxlength="2"/>';
                var meridianTemplate = '<input type="text" name="meridian" class="bootstrap-timepicker-meridian" maxlength="2"/>';
            } else {
                var hourTemplate = '<span class="bootstrap-timepicker-hour"></span>';
                var minuteTemplate = '<span class="bootstrap-timepicker-minute"></span>';
                var secondTemplate = '<span class="bootstrap-timepicker-second"></span>';
                var meridianTemplate = '<span class="bootstrap-timepicker-meridian"></span>';
            }
            var templateContent = '<table class="'+ (this.showSeconds ? 'show-seconds' : '') +' '+ (this.showMeridian ? 'show-meridian' : '') +'">'+
                                       '<tr>'+
                                           '<td><a href="#" data-action="incrementHour"><i class="icon-chevron-up"></i></a></td>'+
                                           '<td class="separator">&nbsp;</td>'+
                                           '<td><a href="#" data-action="incrementMinute"><i class="icon-chevron-up"></i></a></td>'+
                                           (this.showSeconds ?
                                               '<td class="separator">&nbsp;</td>'+
                                               '<td><a href="#" data-action="incrementSecond"><i class="icon-chevron-up"></i></a></td>'
                                           : '') +
                                           (this.showMeridian ?
                                               '<td class="separator">&nbsp;</td>'+
                                               '<td class="meridian-column"><a href="#" data-action="toggleMeridian"><i class="icon-chevron-up"></i></a></td>'
                                           : '') +
                                       '</tr>'+
                                       '<tr>'+
                                           '<td>'+ hourTemplate +'</td> '+
                                           '<td class="separator">:</td>'+
                                           '<td>'+ minuteTemplate +'</td> '+
                                           (this.showSeconds ?
                                                '<td class="separator">:</td>'+
                                                '<td>'+ secondTemplate +'</td>'
                                           : '') +
                                           (this.showMeridian ?
                                                '<td class="separator">&nbsp;</td>'+
                                                '<td>'+ meridianTemplate +'</td>'
                                           : '') +
                                       '</tr>'+
                                       '<tr>'+
                                           '<td><a href="#" data-action="decrementHour"><i class="icon-chevron-down"></i></a></td>'+
                                           '<td class="separator"></td>'+
                                           '<td><a href="#" data-action="decrementMinute"><i class="icon-chevron-down"></i></a></td>'+
                                           (this.showSeconds ?
                                                '<td class="separator">&nbsp;</td>'+
                                                '<td><a href="#" data-action="decrementSecond"><i class="icon-chevron-down"></i></a></td>'
                                           : '') +
                                           (this.showMeridian ?
                                                '<td class="separator">&nbsp;</td>'+
                                                '<td><a href="#" data-action="toggleMeridian"><i class="icon-chevron-down"></i></a></td>'
                                           : '') +
                                       '</tr>'+
                                   '</table>';

            var template;
            switch(this.options.template) {
                case 'modal':
                    template = '<div class="bootstrap-timepicker modal hide fade in" style="top: 30%; margin-top: 0; width: 200px; margin-left: -100px;" data-backdrop="'+ (this.modalBackdrop ? 'true' : 'false') +'">'+
                                   '<div class="modal-header">'+
                                       '<a href="#" class="close" data-dismiss="modal">×</a>'+
                                       '<h3>Pick a Time</h3>'+
                                   '</div>'+
                                   '<div class="modal-content">'+
                                        templateContent +
                                   '</div>'+
                                   '<div class="modal-footer">'+
                                       '<a href="#" class="btn btn-primary" data-dismiss="modal">Ok</a>'+
                                   '</div>'+
                               '</div>';

                break;
                case 'dropdown':
                    template = '<div class="bootstrap-timepicker dropdown-menu">'+
                                    templateContent +
                               '</div>';
                break;

            }
            return template;
        }
    };


    /* TIMEPICKER PLUGIN DEFINITION
     * =========================== */

    $.fn.timepicker = function (option) {
        return this.each(function () {
            var $this = $(this)
            , data = $this.data('timepicker')
            , options = typeof option == 'object' && option;
            if (!data) {
                $this.data('timepicker', (data = new Timepicker(this, options)));
            }
            if (typeof option == 'string') {
                data[option]();
            }
        })
    }

    $.fn.timepicker.defaults = {
      minuteStep: 15
    , secondStep: 15
    , disableFocus: false
    , defaultTime: 'current'
    , showSeconds: false
    , showInputs: true
    , showMeridian: true
    , template: 'dropdown'
    , modalBackdrop: false
    , templates: {} // set custom templates
    }

    $.fn.timepicker.Constructor = Timepicker
}(window.jQuery);
