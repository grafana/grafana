#! /usr/bin/env bash
deb_ver=5.1.0-beta1
rpm_ver=5.1.0-beta1

wget https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana_${deb_ver}_amd64.deb

package_cloud push grafana/testing/debian/jessie grafana_${deb_ver}_amd64.deb
package_cloud push grafana/testing/debian/wheezy grafana_${deb_ver}_amd64.deb
package_cloud push grafana/testing/debian/stretch grafana_${deb_ver}_amd64.deb

wget https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana-${rpm_ver}.x86_64.rpm

package_cloud push grafana/testing/el/6 grafana-${rpm_ver}.x86_64.rpm
package_cloud push grafana/testing/el/7 grafana-${rpm_ver}.x86_64.rpm

rm grafana*.{deb,rpm}
