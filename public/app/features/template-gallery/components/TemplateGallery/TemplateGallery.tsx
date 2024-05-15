import React from 'react';

import { Card, TagList } from '@grafana/ui';
import { DashboardDataDTO } from 'app/types';

// Create the export interface for the response
/**
 * {
            "id": 1860,
            "status": 1,
            "statusCode": "active",
            "orgId": 54000,
            "orgSlug": "rfraile",
            "orgName": "rfmoz",
            "slug": "node-exporter-full",
            "downloads": 38428658,
            "revisionId": 31885,
            "revision": 36,
            "name": "Node Exporter Full",
            "description": "",
            "readme": "Nearly all default values exported by Prometheus node exporter graphed.\r\n\r\nOnly requires the default job_name: node, add as many targets as you need in '/etc/prometheus/prometheus.yml'.\r\n\r\n\r\n```\r\n  - job_name: node\r\n    static_configs:\r\n      - targets: ['localhost:9100']\r\n```\r\n\r\nRecommended for prometheus-node-exporter the arguments '--collector.systemd --collector.processes' because the graph uses some of their metrics.\r\n\r\nSince revision 16, for prometheus-node-exporter v0.18 or newer.\r\nSince revision 12, for prometheus-node-exporter v0.16 or newer.\r\n\r\nAvailable on github: [https://github.com/rfmoz/grafana-dashboards.git](https://github.com/rfmoz/grafana-dashboards.git)",
            "collectorType": "nodeExporter",
            "collectorConfig": null,
            "collectorPluginList": "conntrack, cpu, diskstats, entropy, filefd, filesystem, loadavg, meminfo, netdev, netstat, stat, time, vmstat, interrupts",
            "datasource": "Prometheus",
            "privacy": "public",
            "createdAt": "2017-04-04T10:21:52.000Z",
            "updatedAt": "2024-03-06T06:33:51.000Z",
            "isEditor": false,
            "screenshots": [
                {
                    "id": 7994,
                    "dashboardId": 1860,
                    "name": "",
                    "filename": "c1.png",
                    "mainScreenshot": false,
                    "createdAt": "2020-04-25T13:31:55.000Z",
                    "updatedAt": null,
                    "links": [
                        {
                            "rel": "self",
                            "href": "/dashboards/1860/images/7994"
                        },
                        {
                            "rel": "image",
                            "href": "/dashboards/1860/images/7994/image"
                        },
                        {
                            "rel": "thumbnail",
                            "href": "/dashboards/1860/images/7994/thumbnail"
                        },
                        {
                            "rel": "dashboard",
                            "href": "/dashboards/1860"
                        }
                    ]
                },
                {
                    "id": 7995,
                    "dashboardId": 1860,
                    "name": "",
                    "filename": "c2.png",
                    "mainScreenshot": false,
                    "createdAt": "2020-04-25T13:31:56.000Z",
                    "updatedAt": null,
                    "links": [
                        {
                            "rel": "self",
                            "href": "/dashboards/1860/images/7995"
                        },
                        {
                            "rel": "image",
                            "href": "/dashboards/1860/images/7995/image"
                        },
                        {
                            "rel": "thumbnail",
                            "href": "/dashboards/1860/images/7995/thumbnail"
                        },
                        {
                            "rel": "dashboard",
                            "href": "/dashboards/1860"
                        }
                    ]
                }
            ],
            "hasLogo": true,
            "reviewsCount": 78,
            "reviewsAvgRating": 4.88,
            "links": [
                {
                    "rel": "self",
                    "href": "/dashboards/1860"
                },
                {
                    "rel": "revisions",
                    "href": "/dashboards/1860/revisions"
                },
                {
                    "rel": "revision",
                    "href": "/dashboards/1860/revisions/36"
                },
                {
                    "rel": "download",
                    "href": "/dashboards/1860/revisions/36/download"
                },
                {
                    "rel": "org",
                    "href": "/orgs/rfraile"
                },
                {
                    "rel": "images",
                    "href": "/dashboards/1860/images"
                },
                {
                    "rel": "thumbnails",
                    "href": "/dashboards/1860/thumbnails"
                }
            ],
            "datasourceSlugs": [
                "prometheus"
            ],
            "logos": {
                "small": {
                    "type": "image/png",
                    "filename": "/dashboards/1860/small_logo/images.png",
                    "content": "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"
                }
            }
        },
 */
export interface GalleryItem {
  id: number;
  status: number;
  statusCode: string;
  orgId: number;
  orgSlug: string;
  orgName: string;
  slug: string;
  downloads: number;
  revisionId: number;
  revision: number;
  name: string;
  description: string;
  readme: string;
  collectorType: string;
  collectorConfig: any;
  collectorPluginList: string;
  datasource: string;
  privacy: string;
  createdAt: string;
  updatedAt: string;
  isEditor: boolean;
  screenshots: Screenshot[];
  hasLogo: boolean;
  reviewsCount: number;
  reviewsAvgRating: number;
  links: Link[];
  datasourceSlugs: string[];
  logos: {
    small: {
      type: string;
      filename: string;
      content: string;
    };
  };
}

export interface Link {
  rel: string;
  href: string;
}

export interface Screenshot {
  id: number;
  dashboardId: number;
  name: string;
  filename: string;
  mainScreenshot: boolean;
  createdAt: string;
  updatedAt: string;
  links: Link[];
}

export interface GalleryResponse {
  direction: string;
  items: GalleryItem[];
  links: Link[];
  orderBy: string;
  page: number;
  pageSize: number;
  pages: number;
  total: number;
}

interface TemplateGalleryProps {
  items: DashboardDataDTO[];
}

export function TemplateGallery({ items }: TemplateGalleryProps) {
  return items.map((dashboard: DashboardDataDTO) => {
    return <DashboardItem key={dashboard.uid} dashboard={dashboard} />;
  });
}

function DashboardItem({ dashboard }: { dashboard: DashboardDataDTO }) {
  return (
    <Card>
      <Card.Heading>{dashboard.title}</Card.Heading>
      <Card.Meta>
        <>Template</>
      </Card.Meta>
      <Card.Description>{dashboard.description}</Card.Description>
      <Card.Tags>
        <TagList tags={dashboard.tags ?? []} />
      </Card.Tags>
    </Card>
  );
}
