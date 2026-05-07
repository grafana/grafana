import dashboardLibrary1 from 'img/dashboard-library/dashboard_library_1.jpg';
import dashboardLibrary2 from 'img/dashboard-library/dashboard_library_2.jpg';
import dashboardLibrary3 from 'img/dashboard-library/dashboard_library_3.jpg';
import dashboardLibrary4 from 'img/dashboard-library/dashboard_library_4.jpg';
import dashboardLibrary5 from 'img/dashboard-library/dashboard_library_5.jpg';
import dashboardLibrary6 from 'img/dashboard-library/dashboard_library_6.jpg';

/**
 * Collection of placeholder images for provisioned/plugin dashboards
 */
export const DASHBOARD_PLACEHOLDER_IMAGES = [
  dashboardLibrary1,
  dashboardLibrary2,
  dashboardLibrary3,
  dashboardLibrary4,
  dashboardLibrary5,
  dashboardLibrary6,
];

/**
 * Get a placeholder image URL for a provisioned dashboard by index.
 * Cycles through available images if index exceeds collection size.
 */
export function getProvisionedDashboardImageUrl(index: number): string {
  return DASHBOARD_PLACEHOLDER_IMAGES[index % DASHBOARD_PLACEHOLDER_IMAGES.length];
}
