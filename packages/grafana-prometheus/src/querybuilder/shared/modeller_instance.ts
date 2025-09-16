import { PromQueryModeller } from '../PromQueryModeller';
import { PromQueryModellerInterface } from '../types';

/**
 * This singleton instance of the Prometheus query modeller is a central point
 * for accessing the query modeller functionality while avoiding circular
 * dependencies in the codebase.
 */

export const promQueryModeller: PromQueryModellerInterface = new PromQueryModeller();
