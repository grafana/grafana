import { Fragment } from 'react';
import Skeleton from 'react-loading-skeleton';

import { ScrollContainer, Text } from '@grafana/ui';
import { SkeletonComponent, attachSkeleton } from '@grafana/ui/src/unstable';

import { Settings } from './AdminSettings';

interface Props {
  settings: Settings;
}

const AdminSettingsTableComponent = ({ settings }: Props) => {
  return (
    <ScrollContainer overflowY="visible" overflowX="auto" width="100%">
      <table className="filter-table">
        <tbody>
          {Object.entries(settings).map(([sectionName, sectionSettings], i) => (
            <Fragment key={`section-${i}`}>
              <tr>
                <td>
                  <Text color="info" weight="bold">
                    {sectionName}
                  </Text>
                </td>
                <td />
              </tr>
              {Object.entries(sectionSettings).map(([settingName, settingValue], j) => (
                <tr key={`property-${j}`}>
                  <td style={{ paddingLeft: '25px' }}>{settingName}</td>
                  <td style={{ whiteSpace: 'break-spaces' }}>{settingValue}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </ScrollContainer>
  );
};

// note: don't want to put this in render function else it will get regenerated
const randomValues = new Array(50).fill(null).map(() => Math.random());

const AdminSettingsTableSkeleton: SkeletonComponent = ({ rootProps }) => {
  return (
    <ScrollContainer overflowY="visible" overflowX="auto" width="100%">
      <table className="filter-table" {...rootProps}>
        <tbody>
          {randomValues.map((randomValue, index) => {
            const isSection = index === 0 || randomValue > 0.9;

            return (
              <Fragment key={index}>
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
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </ScrollContainer>
  );
};

function getRandomInRange(min: number, max: number, randomSeed: number) {
  return randomSeed * (max - min) + min;
}

export const AdminSettingsTable = attachSkeleton(AdminSettingsTableComponent, AdminSettingsTableSkeleton);
