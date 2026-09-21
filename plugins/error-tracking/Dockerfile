# Build the frontend app plugin without building Grafana core.

ARG GRAFANA_IMAGE=grafana/grafana-enterprise@sha256:184dfb3137aab22c3fdfbd60e622ba4f71ed56ad059c813b15d018ccd59102e1

FROM --platform=$BUILDPLATFORM node:24.11.0-alpine AS frontend
WORKDIR /grafana

COPY package.json project.json nx.json yarn.lock .yarnrc.yml tsconfig.json .browserslistrc ./
COPY .yarn .yarn
COPY packages packages
COPY public/app/plugins public/app/plugins
COPY e2e-playwright e2e-playwright
COPY plugins/error-tracking/package.json plugins/error-tracking/package.json

RUN yarn install --immutable
COPY plugins/error-tracking plugins/error-tracking
RUN yarn workspace @grafana-plugins/grafana-errortracking-app build

FROM ${GRAFANA_IMAGE}
ENV GF_PATHS_PLUGINS=/opt/grafana/plugins
COPY --from=frontend /grafana/plugins/error-tracking/dist /opt/grafana/plugins/grafana-errortracking-app
