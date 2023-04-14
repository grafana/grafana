import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getGlobalStyles(theme: GrafanaTheme2) {
  return css`
    .moveable-control-box {
      z-index: 999;
    }
    ,
    .rc-tree {
      margin: 0;
      margin-bottom: 15px;
      border: 1px solid transparent;

      &-focused:not(&-active-focused) {
        border-color: cyan;
      }

      .rc-tree-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
      }

      .rc-tree-treenode {
        margin: 0;
        padding: 1px;
        line-height: 24px;
        white-space: nowrap;
        list-style: none;
        outline: 0;

        display: flex;
        margin-bottom: 3px;
        cursor: pointer;

        .draggable {
          color: #333;
          -moz-user-select: none;
          -khtml-user-select: none;
          -webkit-user-select: none;
          user-select: none;
          /* Required to make elements draggable in old WebKit */
          // -khtml-user-drag: element;
          // -webkit-user-drag: element;
        }

        &.drop-container {
          > .draggable::after {
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            box-shadow: inset 0 0 0 2px blue;
            content: '';
          }
          & ~ .rc-tree-treenode {
            border-left: 2px solid ${theme.components.input.borderColor};
          }
        }
        &.drop-target {
          & ~ .rc-tree-treenode {
            border-left: none;
          }
        }
        &.filter-node {
          > .rc-tree-node-content-wrapper {
            color: #a60000 !important;
            font-weight: bold !important;
          }
        }
        ul {
          margin: 0;
          padding: 0 0 0 18px;
        }
        .rc-tree-node-content-wrapper {
          position: relative;
          display: inline-block;
          height: 24px;
          margin: 0;
          padding: 0;
          text-decoration: none;
          vertical-align: top;
          cursor: grab;
          flex-grow: 1;
          display: flex;

          border: 1px solid ${theme.components.input.borderColor};
          border-radius: ${theme.shape.borderRadius(1)};
          background: ${theme.colors.background.secondary};
          min-height: ${theme.spacing.gridSize * 4}px;

          &:hover {
            border: 1px solid ${theme.components.input.borderHover};
          }

          &.rc-tree-node-selected {
            border: 1px solid ${theme.colors.primary.border};
            opacity: 1;
          }
        }

        span {
          &.rc-tree-checkbox,
          &.rc-tree-iconEle {
            display: inline-block;
            width: 16px;
            height: 16px;
            margin-right: 2px;
            line-height: 16px;
            vertical-align: -0.125em;
            background-color: transparent;
            background-repeat: no-repeat;
            background-attachment: scroll;
            border: 0 none;
            outline: none;
            cursor: pointer;

            &.rc-tree-icon__customize {
              background-image: none;
            }
          }
          &.rc-tree-switcher {
            display: flex;
            align-items: center;
            width: 16px;
            background-color: transparent;
            background-repeat: no-repeat;
            background-attachment: scroll;
            border: 0 none;
            outline: none;
            cursor: pointer;

            &.rc-tree-icon__customize {
              background-image: none;
            }
          }
          &.rc-tree-icon_loading {
            margin-right: 2px;
            vertical-align: top;
            background: url('data:image/gif;base64,R0lGODlhEAAQAKIGAMLY8YSx5HOm4Mjc88/g9Ofw+v///wAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQFCgAGACwAAAAAEAAQAAADMGi6RbUwGjKIXCAA016PgRBElAVlG/RdLOO0X9nK61W39qvqiwz5Ls/rRqrggsdkAgAh+QQFCgAGACwCAAAABwAFAAADD2hqELAmiFBIYY4MAutdCQAh+QQFCgAGACwGAAAABwAFAAADD1hU1kaDOKMYCGAGEeYFCQAh+QQFCgAGACwKAAIABQAHAAADEFhUZjSkKdZqBQG0IELDQAIAIfkEBQoABgAsCgAGAAUABwAAAxBoVlRKgyjmlAIBqCDCzUoCACH5BAUKAAYALAYACgAHAAUAAAMPaGpFtYYMAgJgLogA610JACH5BAUKAAYALAIACgAHAAUAAAMPCAHWFiI4o1ghZZJB5i0JACH5BAUKAAYALAAABgAFAAcAAAMQCAFmIaEp1motpDQySMNFAgA7')
              no-repeat scroll 0 0 transparent;
          }
          &.rc-tree-switcher {
            &.rc-tree-switcher-noop {
              cursor: auto;
            }
            &.rc-tree-switcher_open {
              background-position: -93px -56px;
            }
            &.rc-tree-switcher_close {
              background-position: -75px -56px;
            }
          }
          &.rc-tree-checkbox {
            width: 13px;
            height: 13px;
            margin: 0 3px;
            background-position: 0 0;
            &-checked {
              background-position: -14px 0;
            }
            &-indeterminate {
              background-position: -14px -28px;
            }
            &-disabled {
              background-position: 0 -56px;
            }
            &.rc-tree-checkbox-checked.rc-tree-checkbox-disabled {
              background-position: -14px -56px;
            }
            &.rc-tree-checkbox-indeterminate.rc-tree-checkbox-disabled {
              position: relative;
              background: #ccc;
              border-radius: 3px;
              &::after {
                position: absolute;
                top: 5px;
                left: 3px;
                width: 5px;
                height: 0;
                border: 2px solid #fff;
                border-top: 0;
                border-left: 0;
                -webkit-transform: scale(1);
                transform: scale(1);
                content: ' ';
              }
            }
          }
        }
      }
      &:not(.rc-tree-show-line) {
        .rc-tree-treenode {
          .rc-tree-switcher-noop {
            background: none;
          }
        }
      }
      &.rc-tree-show-line {
        .rc-tree-treenode:not(:last-child) {
          > ul {
            background: url('data:image/gif;base64,R0lGODlhCQACAIAAAMzMzP///yH5BAEAAAEALAAAAAAJAAIAAAIEjI9pUAA7') 0 0
              repeat-y;
          }
          > .rc-tree-switcher-noop {
            background-position: -56px -18px;
          }
        }
        .rc-tree-treenode:last-child {
          > .rc-tree-switcher-noop {
            background-position: -56px -36px;
          }
        }
      }
      &-child-tree {
        display: none;
        &-open {
          display: block;
        }
      }
      &-treenode-disabled {
        > span:not(.rc-tree-switcher),
        > a,
        > a span {
          color: #767676;
          cursor: not-allowed;
        }
      }
      &-treenode-active {
        background: rgba(0, 0, 0, 0.1);
      }
      &-node-selected {
        opacity: 0.8;
      }
      &-icon__open {
        margin-right: 2px;
        vertical-align: top;
        background-position: -110px -16px;
      }
      &-icon__close {
        margin-right: 2px;
        vertical-align: top;
        background-position: -110px 0;
      }
      &-icon__docu {
        margin-right: 2px;
        vertical-align: top;
        background-position: -110px -32px;
      }
      &-icon__customize {
        margin-right: 2px;
        vertical-align: top;
      }
      &-title {
        display: inline-block;
      }
      &-indent {
        display: inline-block;
        height: 0;
        vertical-align: bottom;
      }
      &-indent-unit {
        display: inline-block;
        width: 16px;
      }

      &-draggable-icon {
        display: inline-flex;
        justify-content: center;
        width: 16px;
      }
    }
  `;
}
