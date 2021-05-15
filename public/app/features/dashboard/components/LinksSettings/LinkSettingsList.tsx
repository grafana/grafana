import React, { useState } from 'react';
import { css } from 'emotion';
import { DeleteButton, Icon, IconButton, Tag, useTheme } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { arrayMove } from 'app/core/utils/arrayMove';
import { DashboardModel, DashboardLink } from '../../state/DashboardModel';

type LinkSettingsListProps = {
  dashboard: DashboardModel;
  setupNew: () => void;
  editLink: (idx: number) => void;
};

export const LinkSettingsList: React.FC<LinkSettingsListProps> = ({ dashboard, setupNew, editLink }) => {
  const theme = useTheme();
  // @ts-ignore
  const [renderCounter, setRenderCounter] = useState(0);

  const moveLink = (idx: number, direction: number) => {
    arrayMove(dashboard.links, idx, idx + direction);
    setRenderCounter((renderCount) => renderCount + 1);
  };
  const duplicateLink = (link: DashboardLink, idx: number) => {
    dashboard.links.splice(idx, 0, link);
    dashboard.updateSubmenuVisibility();
    setRenderCounter((renderCount) => renderCount + 1);
  };
  const deleteLink = (idx: number) => {
    dashboard.links.splice(idx, 1);
    dashboard.updateSubmenuVisibility();
    setRenderCounter((renderCount) => renderCount + 1);
  };

  return (
    <div>
      {dashboard.links.length === 0 ? (
        <EmptyListCTA
          onClick={setupNew}
          title="There are no dashboard links added yet"
          buttonIcon="link"
          buttonTitle="Add Dashboard Link"
          infoBoxTitle="What are Dashboard Links?"
          infoBox={{
            __html:
              '<p>Dashboard Links allow you to place links to other dashboards and web sites directly below the dashboard header.</p>',
          }}
        />
      ) : (
        <table className="filter-table filter-table--hover">
          <thead>
            <tr>
              <th>Type</th>
              <th>Info</th>
              <th colSpan={3} />
            </tr>
          </thead>
          <tbody>
            {dashboard.links.map((link, idx) => (
              <tr key={idx}>
                <td className="pointer" onClick={() => editLink(idx)}>
                  <Icon
                    name="external-link-alt"
                    className={css`
                      margin-right: ${theme.spacing.xs};
                    `}
                  />
                  {link.type}
                </td>
                <td>
                  {link.title && <div>{link.title}</div>}
                  {!link.title && link.url ? <div>{link.url}</div> : null}
                  {!link.title && link.tags
                    ? link.tags.map((tag, idx) => (
                        <Tag
                          name={tag}
                          key={tag}
                          className={
                            idx !== 0
                              ? css`
                                  margin-left: ${theme.spacing.xs};
                                `
                              : ''
                          }
                        />
                      ))
                    : null}
                </td>
                <td style={{ width: '1%' }}>
                  {idx !== 0 && (
                    <IconButton
                      surface="header"
                      name="arrow-up"
                      aria-label="arrow-up"
                      onClick={() => moveLink(idx, -1)}
                    />
                  )}
                </td>
                <td style={{ width: '1%' }}>
                  {dashboard.links.length > 1 && idx !== dashboard.links.length - 1 ? (
                    <IconButton
                      surface="header"
                      name="arrow-down"
                      aria-label="arrow-down"
                      onClick={() => moveLink(idx, 1)}
                    />
                  ) : null}
                </td>
                <td style={{ width: '1%' }}>
                  <IconButton surface="header" aria-label="copy" name="copy" onClick={() => duplicateLink(link, idx)} />
                </td>
                <td style={{ width: '1%' }}>
                  <DeleteButton size="sm" onConfirm={() => deleteLink(idx)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
