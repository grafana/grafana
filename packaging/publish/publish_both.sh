#! /usr/bin/env bash
version=5.4.2

# wget https://dl.grafana.com/oss/release/grafana_${version}_amd64.deb
#
# package_cloud push grafana/stable/debian/jessie grafana_${version}_amd64.deb
# package_cloud push grafana/stable/debian/wheezy grafana_${version}_amd64.deb
# package_cloud push grafana/stable/debian/stretch grafana_${version}_amd64.deb
#
# package_cloud push grafana/testing/debian/jessie grafana_${version}_amd64.deb
# package_cloud push grafana/testing/debian/wheezy grafana_${version}_amd64.deb --verbose
# package_cloud push grafana/testing/debian/stretch grafana_${version}_amd64.deb --verbose

wget https://dl.grafana.com/oss/release/grafana-${version}-1.x86_64.rpm

package_cloud push grafana/testing/el/6 grafana-${version}-1.x86_64.rpm --verbose
package_cloud push grafana/testing/el/7 grafana-${version}-1.x86_64.rpm --verbose

package_cloud push grafana/stable/el/7 grafana-${version}-1.x86_64.rpm --verbose
package_cloud push grafana/stable/el/6 grafana-${version}-1.x86_64.rpm --verbose

rm grafana*.{deb,rpm}
