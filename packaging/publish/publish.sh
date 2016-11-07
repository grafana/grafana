#! /usr/bin/env bash

deb_ver=3.1.1-1470047149
rpm_ver=3.1.1-1470047149

wget https://grafanarel.s3.amazonaws.com/builds/grafana_${deb_ver}_amd64.deb

package_cloud push grafana/stable/debian/jessie grafana_${deb_ver}_amd64.deb
package_cloud push grafana/stable/debian/wheezy grafana_${deb_ver}_amd64.deb

package_cloud push grafana/testing/debian/jessie grafana_${deb_ver}_amd64.deb
package_cloud push grafana/testing/debian/wheezy grafana_${deb_ver}_amd64.deb

wget https://grafanarel.s3.amazonaws.com/builds/grafana-${rpm_ver}.x86_64.rpm

package_cloud push grafana/testing/el/6 grafana-${rpm_ver}.x86_64.rpm
package_cloud push grafana/testing/el/7 grafana-${rpm_ver}.x86_64.rpm

package_cloud push grafana/stable/el/7 grafana-${rpm_ver}.x86_64.rpm
package_cloud push grafana/stable/el/6 grafana-${rpm_ver}.x86_64.rpm
