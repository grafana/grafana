import { LogLevel } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

export function contentOutlineTrackPinAdded() {
  reportInteraction('explore_toolbar_contentoutline_clicked', {
    item: 'section',
    type: 'Logs:pinned:pinned-log-added',
  });
}

export function contentOutlineTrackPinRemoved() {
  reportInteraction('explore_toolbar_contentoutline_clicked', {
    item: 'section',
    type: 'Logs:pinned:pinned-log-deleted',
  });
}

export function contentOutlineTrackPinLimitReached() {
  reportInteraction('explore_toolbar_contentoutline_clicked', {
    item: 'section',
    type: 'Logs:pinned:pinned-log-limit-reached',
  });
}

export function contentOutlineTrackPinClicked() {
  reportInteraction('explore_toolbar_contentoutline_clicked', {
    item: 'section',
    type: 'Logs:pinned:pinned-log-clicked',
  });
}

export function contentOutlineTrackUnpinClicked() {
  reportInteraction('explore_toolbar_contentoutline_clicked', {
    item: 'section',
    type: 'Logs:pinned:pinned-log-deleted',
  });
}

export function contentOutlineTrackLevelFilter(level: LogLevel) {
  reportInteraction('explore_toolbar_contentoutline_clicked', {
    item: 'section',
    type: `Logs:filter:${level}`,
  });
}
