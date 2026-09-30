import { config } from '../../config';

export async function loadGrowthCohortContext(): Promise<{
  growthCohorts: string[];
  growthCohortsAvailable: boolean;
}> {
  const unavailable = { growthCohorts: [], growthCohortsAvailable: false };
  const orgID = config.openFeatureContext.gcomOrgID;
  if (!config.bootData.user.isSignedIn || typeof orgID !== 'string' || !/^[1-9][0-9]*$/.test(orgID)) {
    return unavailable;
  }

  const controller = new AbortController();
  // Cohort lookup must not hold up ordinary flag initialization during a GCOM outage.
  const timeout = setTimeout(() => controller.abort(), 1000);
  try {
    const response = await fetch(`${config.appSubUrl || ''}/api/gnet/growth/cohorts/${orgID}`, {
      credentials: 'same-origin',
      signal: controller.signal,
    });
    if (!response.ok) {
      return unavailable;
    }
    const data: unknown = await response.json();
    if (
      typeof data !== 'object' ||
      data === null ||
      !('cohorts' in data) ||
      !Array.isArray(data.cohorts) ||
      !data.cohorts.every((cohort): cohort is string => typeof cohort === 'string')
    ) {
      return unavailable;
    }
    return { growthCohorts: data.cohorts, growthCohortsAvailable: true };
  } catch {
    return unavailable;
  } finally {
    clearTimeout(timeout);
  }
}
