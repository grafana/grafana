import { AccessControlAction } from 'app/types';

/**
 * List of granular permissions that allow viewing contact points
 */
export const PERMISSIONS_TIME_INTERVALS_READ = [AccessControlAction.AlertingTimeIntervalsRead];

/**
 * List of granular permissions that allow modifying time intervals
 */
export const PERMISSIONS_TIME_INTERVALS_MODIFY = [AccessControlAction.AlertingTimeIntervalsWrite];

export const PERMISSIONS_TIME_INTERVALS = [...PERMISSIONS_TIME_INTERVALS_READ, ...PERMISSIONS_TIME_INTERVALS_MODIFY];
