// Type definitions for Moment.js 2.8.0
// Project: https://github.com/timrwood/moment
// Definitions by: Michael Lakerveld <https://github.com/Lakerfield>, Aaron King <https://github.com/kingdango>, Hiroki Horiuchi <https://github.com/horiuchi>, Dick van den Brink <https://github.com/DickvdBrink>, Adi Dahiya <https://github.com/adidahiya>, Matt Brooks <https://github.com/EnableSoftware>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

declare module moment {

    interface MomentInput {

        /** Year */
        years?: number;
        /** Year */
        year?: number;
        /** Year */
        y?: number;

        /** Month */
        months?: number;
        /** Month */
        month?: number;
        /** Month */
        M?: number;

        /** Day/Date */
        days?: number;
        /** Day/Date */
        day?: number;
        /** Day/Date */
        date?: number;
        /** Day/Date */
        d?: number;

        /** Hour */
        hours?: number;
        /** Hour */
        hour?: number;
        /** Hour */
        h?: number;

        /** Minute */
        minutes?: number;
        /** Minute */
        minute?: number;
        /** Minute */
        m?: number;

        /** Second */
        seconds?: number;
        /** Second */
        second?: number;
        /** Second */
        s?: number;

        /** Millisecond */
        milliseconds?: number;
        /** Millisecond */
        millisecond?: number;
        /** Millisecond */
        ms?: number;

    }

    interface Duration {

        humanize(withSuffix?: boolean): string;

        as(units: string): number;

        milliseconds(): number;
        asMilliseconds(): number;

        seconds(): number;
        asSeconds(): number;

        minutes(): number;
        asMinutes(): number;

        hours(): number;
        asHours(): number;

        days(): number;
        asDays(): number;

        months(): number;
        asMonths(): number;

        years(): number;
        asYears(): number;

        add(n: number, p: string): Duration;
        add(n: number): Duration;
        add(d: Duration): Duration;

        subtract(n: number, p: string): Duration;
        subtract(n: number): Duration;
        subtract(d: Duration): Duration;

        toISOString(): string;
        toJSON(): string;

    }

    interface Moment {

        format(format: string): string;
        format(): string;

        fromNow(withoutSuffix?: boolean): string;

        startOf(unitOfTime: string): Moment;
        endOf(unitOfTime: string): Moment;

        /**
         * Mutates the original moment by adding time. (deprecated in 2.8.0)
         *
         * @param unitOfTime the unit of time you want to add (eg "years" / "hours" etc)
         * @param amount the amount you want to add
         */
        add(unitOfTime: string, amount: number): Moment;
        /**
         * Mutates the original moment by adding time.
         *
         * @param amount the amount you want to add
         * @param unitOfTime the unit of time you want to add (eg "years" / "hours" etc)
         */
        add(amount: number, unitOfTime: string): Moment;
        /**
         * Mutates the original moment by adding time. Note that the order of arguments can be flipped.
         *
         * @param amount the amount you want to add
         * @param unitOfTime the unit of time you want to add (eg "years" / "hours" etc)
         */
        add(amount: string, unitOfTime: string): Moment;
        /**
         * Mutates the original moment by adding time.
         *
         * @param objectLiteral an object literal that describes multiple time units {days:7,months:1}
         */
        add(objectLiteral: MomentInput): Moment;
        /**
         * Mutates the original moment by adding time.
         *
         * @param duration a length of time
         */
        add(duration: Duration): Moment;

        /**
         * Mutates the original moment by subtracting time. (deprecated in 2.8.0)
         *
         * @param unitOfTime the unit of time you want to subtract (eg "years" / "hours" etc)
         * @param amount the amount you want to subtract
         */
        subtract(unitOfTime: string, amount: number): Moment;
        /**
         * Mutates the original moment by subtracting time.
         *
         * @param unitOfTime the unit of time you want to subtract (eg "years" / "hours" etc)
         * @param amount the amount you want to subtract
         */
        subtract(amount: number, unitOfTime: string): Moment;
        /**
         * Mutates the original moment by subtracting time. Note that the order of arguments can be flipped.
         *
         * @param amount the amount you want to add
         * @param unitOfTime the unit of time you want to subtract (eg "years" / "hours" etc)
         */
        subtract(amount: string, unitOfTime: string): Moment;
        /**
         * Mutates the original moment by subtracting time.
         *
         * @param objectLiteral an object literal that describes multiple time units {days:7,months:1}
         */
        subtract(objectLiteral: MomentInput): Moment;
        /**
         * Mutates the original moment by subtracting time.
         *
         * @param duration a length of time
         */
        subtract(duration: Duration): Moment;

        calendar(): string;
        calendar(start: Moment): string;

        clone(): Moment;

        /**
         * @return Unix timestamp, or milliseconds since the epoch.
         */
        valueOf(): number;

        local(): Moment; // current date/time in local mode

        utc(): Moment; // current date/time in UTC mode

        isValid(): boolean;
        invalidAt(): number;

        year(y: number): Moment;
        year(): number;
        quarter(): number;
        quarter(q: number): Moment;
        month(M: number): Moment;
        month(M: string): Moment;
        month(): number;
        day(d: number): Moment;
        day(d: string): Moment;
        day(): number;
        date(d: number): Moment;
        date(): number;
        hour(h: number): Moment;
        hour(): number;
        hours(h: number): Moment;
        hours(): number;
        minute(m: number): Moment;
        minute(): number;
        minutes(m: number): Moment;
        minutes(): number;
        second(s: number): Moment;
        second(): number;
        seconds(s: number): Moment;
        seconds(): number;
        millisecond(ms: number): Moment;
        millisecond(): number;
        milliseconds(ms: number): Moment;
        milliseconds(): number;
        weekday(): number;
        weekday(d: number): Moment;
        isoWeekday(): number;
        isoWeekday(d: number): Moment;
        weekYear(): number;
        weekYear(d: number): Moment;
        isoWeekYear(): number;
        isoWeekYear(d: number): Moment;
        week(): number;
        week(d: number): Moment;
        weeks(): number;
        weeks(d: number): Moment;
        isoWeek(): number;
        isoWeek(d: number): Moment;
        isoWeeks(): number;
        isoWeeks(d: number): Moment;
        weeksInYear(): number;
        isoWeeksInYear(): number;
        dayOfYear(): number;
        dayOfYear(d: number): Moment;

        from(f: Moment|string|number|Date|number[], suffix?: boolean): string;
        to(f: Moment|string|number|Date|number[], suffix?: boolean): string;

        diff(b: Moment): number;
        diff(b: Moment, unitOfTime: string): number;
        diff(b: Moment, unitOfTime: string, round: boolean): number;

        toArray(): number[];
        toDate(): Date;
        toISOString(): string;
        toJSON(): string;
        unix(): number;

        isLeapYear(): boolean;
        zone(): number;
        zone(b: number): Moment;
        zone(b: string): Moment;
        utcOffset(): number;
        utcOffset(b: number): Moment;
        utcOffset(b: string): Moment;
        daysInMonth(): number;
        isDST(): boolean;

        isBefore(): boolean;
        isBefore(b: Moment|string|number|Date|number[], granularity?: string): boolean;

        isAfter(): boolean;
        isAfter(b: Moment|string|number|Date|number[], granularity?: string): boolean;

        isSame(b: Moment|string|number|Date|number[], granularity?: string): boolean;
        isBetween(a: Moment|string|number|Date|number[], b: Moment|string|number|Date|number[], granularity?: string): boolean;

        // Deprecated as of 2.8.0.
        lang(language: string): Moment;
        lang(reset: boolean): Moment;
        lang(): MomentLanguage;

        locale(language: string): Moment;
        locale(reset: boolean): Moment;
        locale(): string;

        localeData(language: string): Moment;
        localeData(reset: boolean): Moment;
        localeData(): MomentLanguage;

        // Deprecated as of 2.7.0.
        max(date: Moment|string|number|Date|any[]): Moment;
        max(date: string, format: string): Moment;

        // Deprecated as of 2.7.0.
        min(date: Moment|string|number|Date|any[]): Moment;
        min(date: string, format: string): Moment;

        get(unit: string): number;
        set(unit: string, value: number): Moment;

    }

    interface MomentCalendar {

      lastDay: any;
      sameDay: any;
      nextDay: any;
      lastWeek: any;
      nextWeek: any;
      sameElse: any;

    }

    interface BaseMomentLanguage {
        months ?: any;
        monthsShort ?: any;
        weekdays ?: any;
        weekdaysShort ?: any;
        weekdaysMin ?: any;
        relativeTime ?: MomentRelativeTime;
        meridiem ?: (hour: number, minute: number, isLowercase: boolean) => string;
        calendar ?: MomentCalendar;
        ordinal ?: (num: number) => string;
    }

    interface MomentLanguage extends BaseMomentLanguage {
      longDateFormat?: MomentLongDateFormat;
    }

    interface MomentLanguageData extends BaseMomentLanguage {
        /**
         * @param formatType should be L, LL, LLL, LLLL.
         */
        longDateFormat(formatType: string): string;
    }

    interface MomentLongDateFormat {

      L: string;
      LL: string;
      LLL: string;
      LLLL: string;
      LT: string;
      l?: string;
      ll?: string;
      lll?: string;
      llll?: string;
      lt?: string;

    }

    interface MomentRelativeTime {

      future: any;
      past: any;
      s: any;
      m: any;
      mm: any;
      h: any;
      hh: any;
      d: any;
      dd: any;
      M: any;
      MM: any;
      y: any;
      yy: any;

    }

    interface MomentStatic {

        version: string;
        fn: Moment;

        (): Moment;
        (date: number): Moment;
        (date: number[]): Moment;
        (date: string, format?: string, strict?: boolean): Moment;
        (date: string, format?: string, language?: string, strict?: boolean): Moment;
        (date: string, formats: string[], strict?: boolean): Moment;
        (date: string, formats: string[], language?: string, strict?: boolean): Moment;
        (date: string, specialFormat: () => void, strict?: boolean): Moment;
        (date: string, specialFormat: () => void, language?: string, strict?: boolean): Moment;
        (date: string, formatsIncludingSpecial: any[], strict?: boolean): Moment;
        (date: string, formatsIncludingSpecial: any[], language?: string, strict?: boolean): Moment;
        (date: Date): Moment;
        (date: Moment): Moment;
        (date: Object): Moment;

        utc(): Moment;
        utc(date: number): Moment;
        utc(date: number[]): Moment;
        utc(date: string, format?: string, strict?: boolean): Moment;
        utc(date: string, format?: string, language?: string, strict?: boolean): Moment;
        utc(date: string, formats: string[], strict?: boolean): Moment;
        utc(date: string, formats: string[], language?: string, strict?: boolean): Moment;
        utc(date: Date): Moment;
        utc(date: Moment): Moment;
        utc(date: Object): Moment;

        unix(timestamp: number): Moment;

        invalid(parsingFlags?: Object): Moment;
        isMoment(): boolean;
        isMoment(m: any): boolean;
        isDate(m: any): boolean;
        isDuration(): boolean;
        isDuration(d: any): boolean;

        // Deprecated in 2.8.0.
        lang(language?: string): string;
        lang(language?: string, definition?: MomentLanguage): string;

        locale(language?: string): string;
        locale(language?: string[]): string;
        locale(language?: string, definition?: MomentLanguage): string;

        localeData(language?: string): MomentLanguageData;

        longDateFormat: any;
        relativeTime: any;
        meridiem: (hour: number, minute: number, isLowercase: boolean) => string;
        calendar: any;
        ordinal: (num: number) => string;

        duration(milliseconds: Number): Duration;
        duration(num: Number, unitOfTime: string): Duration;
        duration(input: MomentInput): Duration;
        duration(object: any): Duration;
        duration(): Duration;

        parseZone(date: string): Moment;

        months(): string[];
        months(index: number): string;
        months(format: string): string[];
        months(format: string, index: number): string;
        monthsShort(): string[];
        monthsShort(index: number): string;
        monthsShort(format: string): string[];
        monthsShort(format: string, index: number): string;

        weekdays(): string[];
        weekdays(index: number): string;
        weekdays(format: string): string[];
        weekdays(format: string, index: number): string;
        weekdaysShort(): string[];
        weekdaysShort(index: number): string;
        weekdaysShort(format: string): string[];
        weekdaysShort(format: string, index: number): string;
        weekdaysMin(): string[];
        weekdaysMin(index: number): string;
        weekdaysMin(format: string): string[];
        weekdaysMin(format: string, index: number): string;

        min(moments: Moment[]): Moment;
        max(moments: Moment[]): Moment;

        normalizeUnits(unit: string): string;
        relativeTimeThreshold(threshold: string): number|boolean;
        relativeTimeThreshold(threshold: string, limit:number): boolean;

        /**
         * Constant used to enable explicit ISO_8601 format parsing.
         */
        ISO_8601(): void;

        defaultFormat: string;

    }

}

declare module 'moment' {
    var moment: moment.MomentStatic;
    export = moment;
}
