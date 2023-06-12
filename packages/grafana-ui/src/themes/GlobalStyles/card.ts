import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getCardStyles(theme: GrafanaTheme2) {
  return css`
    .card-section {
      margin-bottom: ${theme.spacing(4)};
    }

    .card-list {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      list-style-type: none;
    }

    .card-item {
      display: block;
      height: 100%;
      background: ${theme.colors.background.secondary};
      box-shadow: none;
      padding: ${theme.spacing(2)};
      border-radius: 4px;

      &:hover {
        background: ${theme.colors.emphasize(theme.colors.background.secondary, 0.03)};
      }

      .label-tag {
        margin-left: ${theme.spacing(1)};
        font-size: 11px;
        padding: 2px 6px;
      }
    }

    .card-item-body {
      display: flex;
      overflow: hidden;
    }

    .card-item-details {
      overflow: hidden;
    }

    .card-item-header {
      margin-bottom: ${theme.spacing(2)};
    }

    .card-item-type {
      color: ${theme.colors.text.secondary};
      text-transform: uppercase;
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.fontWeightMedium};
    }

    .card-item-badge {
      margin: 6px 0;
    }

    .card-item-notice {
      font-size: ${theme.typography.size.sm};
    }

    .card-item-name {
      color: ${theme.colors.text.primary};
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
    }

    .card-item-label {
      margin-left: ${theme.spacing(1)};
    }

    .card-item-sub-name {
      color: ${theme.colors.text.secondary};
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
    }

    .card-item-sub-name--header {
      color: ${theme.colors.text.secondary};
      text-transform: uppercase;
      margin-bottom: ${theme.spacing(2)};
      font-size: ${theme.typography.size.sm};
      font-weight: bold;
    }

    .card-list-layout-grid {
      .card-item-type {
        display: inline-block;
      }

      .card-item-notice {
        font-size: ${theme.typography.size.sm};
        display: inline-block;
        margin-left: ${theme.spacing(2)};
      }

      .card-item-header-action {
        float: right;
      }

      .card-item-wrapper {
        width: 100%;
        padding: ${theme.spacing(0, 2, 2, 0)};
      }

      .card-item-wrapper--clickable {
        cursor: pointer;
      }

      .card-item-figure {
        margin: ${theme.spacing(0, 2, 2, 0)}0;
        height: 80px;

        img {
          width: 80px;
        }
      }

      .card-item-name {
        font-size: ${theme.typography.h3.fontSize};
      }

      ${theme.breakpoints.up('md')} {
        .card-item-wrapper {
          width: 50%;
        }
      }

      ${theme.breakpoints.up('lg')} {
        .card-item-wrapper {
          width: 33.333333%;
        }
      }

      &.card-list-layout-grid--max-2-col {
        ${theme.breakpoints.up('lg')} {
          .card-item-wrapper {
            width: 50%;
          }
        }
      }
    }

    .card-list-layout-list {
      .card-item-wrapper {
        padding: 0;
        width: 100%;
        margin-bottom: ${theme.spacing(1)};
      }

      .card-item-wrapper--clickable {
        cursor: pointer;
      }

      .card-item {
        border-radius: 2px;
      }

      .card-item-header {
        float: right;
        text-align: right;
      }

      .card-item-figure {
        margin: ${theme.spacing(0, 2, 0, 0)};
        img {
          width: 48px;
        }
      }

      .card-item-name {
        font-size: ${theme.typography.h4.fontSize};
      }

      .card-item-sub-name {
        font-size: ${theme.typography.size.sm};
      }

      .layout-selector {
        margin-right: 0;
      }
    }
  `;
}
