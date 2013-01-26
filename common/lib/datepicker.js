/* =========================================================
 * bootstrap-datepicker.js
 * original by Stefan Petre
 * tweaked by gus
 * ========================================================= */

!function( $ ) {

	// Picker object

	var Datepicker = function(element, options){
		this.element = $(element);

		this.days = options.days||["sun","mon","tue","wed","thu","fri","sat"];
		this.months = options.months||["january","february","march","april","may","june","july","august","september","october","november","december"];
		this.format = options.format||$(element).data("datepicker-format")||'mm/dd/yyyy hh:ii:ss';
		this.noDefault = options.noDefault||$(element).data("datepicker-nodefault")||false;

		this.picker = $(DPGlobal.template).appendTo("body").on({
			mousedown: $.proxy(this.click, this)
		});

		this.weekStart = options.weekStart||0;
		this.weekEnd = this.weekStart == 0 ? 6 : this.weekStart - 1;
		this.head();

		if (!this.element.prop("value")&&!this.noDefault) {
			this.element.prop("value",DPGlobal.formatDate(new Date(), this.format));
		}

		this.update();

		this.element.on({
			focus: $.proxy(this.show, this),
			click: $.proxy(this.show, this),
			keyup: $.proxy(this.keyup, this)
		});
	};

	Datepicker.prototype = {
		constructor: Datepicker,

		show: function(e) {
			this.update();
			this.picker.show();
			this.height = this.element.outerHeight();
			this.place();
			$(window).on("resize", $.proxy(this.place, this));
			if (e) {
				e.stopPropagation();
				e.preventDefault();
			}
			this.element.trigger({
				type: "show",
				date: this.date
			});
			$("body").on("click.bs-sc-datepicker", $.proxy(this.hide, this));
		},

		hide: function(e){
			if (e && $(e.target).parents(".bs-sc-datepicker").length) return false;
			this.picker.hide();
			$(window).off("resize", this.place);
			$("body").off("click.bs-sc-datepicker");
		},

		setValue: function(val) {
			if (typeof(val)!=='undefined') {
				this.date = val;
			}
			var formated = DPGlobal.formatDate(this.date, this.format);
			this.element.prop("value", formated);
		},

		place: function(){
			var offset = this.element.offset();
			this.picker.css({
				top: offset.top + this.height,
				left: offset.left
			});
		},

		update: function(){
			this.date = DPGlobal.parseDate(this.element.prop("value"), this.format);
			this.viewDate = new Date(this.date);
			this.fill();
		},

		keyup: function() {
			this.date = DPGlobal.parseDate(this.element.prop("value"), this.format);
			this.element.trigger({
				type: 'changeDate',
				date: this.date
			});
		},

		head: function(){
			var dowCnt = this.weekStart;
			var html = '<tr>';
			while (dowCnt < this.weekStart + 7) {
				html += '<th class="dow">'+this.days[(dowCnt++)%7]+'</th>';
			}
			html += '</tr>';
			this.picker.find(".datepicker-days thead").append(html);
		},

		fill: function() {
			var d = new Date(this.viewDate),
				year = d.getFullYear(),
				month = d.getMonth(),
				day = d.getDay();

			currentDate = new Date(this.date.getFullYear(), this.date.getMonth(), this.date.getDate(), 0, 0, 0, 0);
			currentDate = currentDate.valueOf();

			if (month > 0) {
				var prevMonth = new Date(year, month-1, 1,0,0,0,0);
				var prevMonthNr = prevMonth.getMonth();
			} else {
				var prevMonth = new Date(year-1, 11, 1, 0, 0, 0, 0);
				var prevMonthNr = prevMonth.getMonth();
			}

			if (month < 11) {
				var nextMonthNr = month + 1;
			} else {
				var nextMonthNr = 0;
			}

			var beginMonth = new Date(year, month, 1,0,0,0,0);
			startAtWeekday = beginMonth.getDay() - this.weekStart;
			if (startAtWeekday < 0) {
				prevMonthDays = DPGlobal.getDaysInMonth(prevMonth.getFullYear(), prevMonth.getMonth());
				startPrevMonthAtDate = prevMonthDays - (6 + startAtWeekday);
			} else if (startAtWeekday > 0) {
				prevMonthDays = DPGlobal.getDaysInMonth(prevMonth.getFullYear(), prevMonth.getMonth());
				startPrevMonthAtDate = prevMonthDays - startAtWeekday + 1;
			} else {
				startPrevMonthAtDate = 1;
				prevMonth.setMonth(month);
			}

			prevMonth.setDate(startPrevMonthAtDate);

			d = prevMonth;

			html = []; allDone = false; x=0;

			while(!allDone) {

				if (d.getDay() == this.weekStart) {

					html.push('<tr>');
				}

				clsName = '';
				if (d.getMonth() == prevMonthNr) {
					clsName += ' old';
				} else if (d.getMonth() == nextMonthNr) {
					clsName += ' new';
				}
				if (d.valueOf() == currentDate) {
					clsName += ' active';
				}
				clsName += ' ' + d.valueOf();
				html.push('<td class="day'+clsName+'">' + d.getDate() + '</td>');

				if (d.getDay() == this.weekEnd) {
					html.push('</tr>');
				}

				d.setDate(d.getDate()+1);
				allDone = ((d.getDay() == this.weekStart) && (d.getMonth() == nextMonthNr));

				x++;
				if (x > 99) {
					console.log("safety");
					return;
				}
			}

			this.picker.find('.datepicker-days tbody').empty().append(html.join(''));

			headerStr = this.months[this.viewDate.getMonth()] + ' ' + this.viewDate.getFullYear();
			this.picker.find('.datepicker-days thead .monthname').html(headerStr);
		},

		click: function(e) {
			e.stopPropagation();
			e.preventDefault();
			var target = $(e.target).closest('span, td, th');
			if (target.length == 1) {

				switch(target[0].nodeName.toLowerCase()) {

					case 'th':
						switch(target[0].className) {
							case 'prev':
								if (this.viewDate.getMonth() > 0) {
									this.viewDate.setMonth(this.viewDate.getMonth() - 1);
								} else {
									this.viewDate.setFullYear(this.viewDate.getFullYear() - 1);
									this.viewDate.setMonth(11);
								}
								break;

							case 'next':
								if (this.viewDate.getMonth() < 11) {
									this.viewDate.setMonth(this.viewDate.getMonth() + 1);
								} else {
									this.viewDate.setFullYear(this.viewDate.getFullYear() + 1);
									this.viewDate.setMonth(0);
								}

								break;
						}
						this.fill();
						break;
					case 'td':
						if (target.is('.day')){
							if (target.is('.old')) {
								return;
							} else if (target.is('.new')) {
								return;
							}

							var day = parseInt(target.text(), 10)||1;
							var month = this.viewDate.getMonth();
							var year = this.viewDate.getFullYear();
							this.date = new Date(year, month, day,this.date.getHours(),this.date.getMinutes(),this.date.getSeconds(),0);
							this.viewDate = new Date(year, month, day,0,0,0,0);
							this.fill();
							this.setValue();
							this.element.trigger({
								type: 'changeDate',
								date: this.date
							});
							this.hide();
						}
						break;
				}
			}
			return false;
		},

	};

	$.fn.datepicker = function ( option ) {
		return this.each(function () {
			var $this = $(this),
				data = $this.data('datepicker'),
				options = typeof option == 'object' && option;
			if (!data) {
				$this.data('datepicker', (data = new Datepicker(this, $.extend({}, $.fn.datepicker.defaults,options))));
			}
			if (typeof option == 'string') data[option]();
		});
	};

	$.fn.datepicker.defaults = {
	};
	$.fn.datepicker.Constructor = Datepicker;

	var DPGlobal = {
		isLeapYear: function (year) {
			return (((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0))
		},
		getDaysInMonth: function (year, month) {
			return [31, (DPGlobal.isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month]
		},
		parseDate: function(dateStr, format) { //convert str into date
			dateStr = dateStr.replace(/:/g, '/');
			dateStr = dateStr.replace(/ /g, '/');
			strParts = dateStr.split('/');

			format = format.replace(/:/g, '/');
			format = format.replace(/ /g, '/');
			formatParts = format.split('/');

			date = new Date(),
			date.setHours(0); date.setMinutes(0); date.setSeconds(0); date.setMilliseconds(0);

			for (var key in formatParts) {
				if (typeof strParts[key] != 'undefined') {
					val = strParts[key];
					switch(formatParts[key]) {
						case 'dd':
						case 'd':
							date.setDate(val);
							break;
						case 'mm':
						case 'm':
							date.setMonth(val - 1);
							break;
						case 'yy':
							date.setFullYear(2000 + val);
							break;
						case 'yyyy':
							date.setFullYear(val);
							break;
						case 'hh':
						case 'h':
							date.setHours(val);
							break;
						case 'ii':
						case 'i':
							date.setMinutes(val);
							break;
						case 'ss':
						case 's':
							date.setSeconds(val);
							break;
					}
				}
			}
			return date;
		},
		formatDate: function(date, format){ // build a formatted string
			var templateParts = {
				dd: (date.getDate() < 10 ? '0' : '') + date.getDate(),
				d: date.getDate(),
				mm: ((date.getMonth() + 1) < 10 ? '0' : '') + (date.getMonth() + 1),
				m: date.getMonth() + 1,
				yyyy: date.getFullYear(),
				yy: date.getFullYear().toString().substring(2),
				hh: (date.getHours() < 10 ? '0' : '') + date.getHours(),
				h: date.getHours(),
				ii: (date.getMinutes() < 10 ? '0' : '') + date.getMinutes(),
				i: date.getMinutes(),
				ss: (date.getSeconds() < 10 ? '0' : '') + date.getSeconds(),
				s: date.getSeconds()
			};

			var dateStr = format;

			for (var key in templateParts) {
			    val = templateParts[key];
			    dateStr = dateStr.replace(key, val);
			}

			return dateStr;
		},
		headTemplate: '<thead>'+
							'<tr>'+
								'<th class="prev"><i>&larr;</i></th>'+
								'<th colspan="5" class="monthname"></th>'+
								'<th class="next"><i>&rarr;</i></th>'+
							'</tr>'+
						'</thead>',
		contTemplate: '<tbody><tr><td colspan="7"></td></tr></tbody>'
	};
	DPGlobal.template = '<div class="bs-sc-datepicker dropdown-menu">'+
							'<div class="datepicker-days">'+
								'<table class=" table-condensed">'+
									DPGlobal.headTemplate+
									'<tbody></tbody>'+
								'</table>'+
							'</div>'+
						'</div>';

}( window.jQuery );

$(function() {
	$("input[data-datepicker-format]").datepicker({
		weekStart: 1,
		days: ["zo","ma","di","wo","do","vr","za"],
		months: ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"]
	});
});