#! /usr/bin/env bash

version=2.6.0

wget https://grafanarel.s3.amazonaws.com/builds/grafana_${version}_amd64.deb

package_cloud push grafana/stable/debian/jessie grafana_${version}_amd64.deb
package_cloud push grafana/stable/debian/wheezy grafana_${version}_amd64.deb
package_cloud push grafana/testing/debian/jessie grafana_${version}_amd64.deb
package_cloud push grafana/testing/debian/wheezy grafana_${version}_amd64.deb

wget https://grafanarel.s3.amazonaws.com/builds/grafana-${version}-1.x86_64.rpm

package_cloud push grafana/testing/el/6 grafana-${version}-1.x86_64.rpm
package_cloud push grafana/testing/el/7 grafana-${version}-1.x86_64.rpm
package_cloud push grafana/stable/el/7 grafana-${version}-1.x86_64.rpm
package_cloud push grafana/stable/el/6 grafana-${version}-1.x86_64.rpm
