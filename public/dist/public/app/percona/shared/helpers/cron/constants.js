export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const UNITS = [
    {
        type: 'minutes',
        min: 0,
        max: 59,
        total: 60,
    },
    {
        type: 'hours',
        min: 0,
        max: 23,
        total: 24,
    },
    {
        type: 'month-days',
        min: 1,
        max: 31,
        total: 31,
    },
    {
        type: 'months',
        min: 1,
        max: 12,
        total: 12,
        // DO NO EDIT
        // Only used internally for Cron syntax
        // alt values used for labels are in ./locale.ts file
        alt: MONTHS,
    },
    {
        type: 'week-days',
        min: 0,
        max: 6,
        total: 7,
        // DO NO EDIT
        // Only used internally for Cron syntax
        // alt values used for labels are in ./locale.ts file
        alt: WEEKDAYS,
    },
];
//# sourceMappingURL=constants.js.map