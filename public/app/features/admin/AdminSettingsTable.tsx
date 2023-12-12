import React from 'react';
import Skeleton from 'react-loading-skeleton';

import { SkeletonComponent, attachSkeleton } from '@grafana/ui/src/unstable';

import { Settings } from './AdminSettings';

interface Props {
  settings: Settings;
}

const AdminSettingsTableComponent = ({ settings }: Props) => {
  return (
    <table className="filter-table">
      <tbody>
        {Object.entries(settings).map(([sectionName, sectionSettings], i) => (
          <React.Fragment key={`section-${i}`}>
            <tr>
              <td className="admin-settings-section">{sectionName}</td>
              <td />
            </tr>
            {Object.entries(sectionSettings).map(([settingName, settingValue], j) => (
              <tr key={`property-${j}`}>
                <td style={{ paddingLeft: '25px' }}>{settingName}</td>
                <td style={{ whiteSpace: 'break-spaces' }}>{settingValue}</td>
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
};

// note: don't want to put this in render function else it will get regenerated
const randomValues = new Array(50).fill(null).map(() => Math.random());

const AdminSettingsTableSkeleton: SkeletonComponent = ({ rootProps }) => {
  return (
    <table className="filter-table" {...rootProps}>
      <tbody>
        {randomValues.map((randomValue, index) => {
          const isSection = index === 0 || randomValue > 0.9;

          return (
            <React.Fragment key={index}>
              {isSection && (
                <tr>
                  <td className="admin-settings-section">
                    <Skeleton width={getRandomInRange(40, 80, randomValue)} />
                  </td>
                  <td />
                </tr>
              )}
              <tr>
                <td style={{ paddingLeft: '25px' }}>
                  <Skeleton width={getRandomInRange(60, 100, randomValue)} />
                </td>
                <td>
                  <Skeleton width={getRandomInRange(80, 320, randomValue)} />
                </td>
              </tr>
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
};

function getRandomInRange(min: number, max: number, randomSeed: number) {
  return randomSeed * (max - min) + min;
}

export const AdminSettingsTable = attachSkeleton(AdminSettingsTableComponent, AdminSettingsTableSkeleton);
