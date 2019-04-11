#!/usr/bin/env python
#
# Creates .wxs files to be used to generate multiple MSI targets
#
# by default the script will check for dist and enterprise-dist, and parse
# the version as needed options are provided to give a build version that will
# download the zip, drop in to dist/enterprise-dist and do the same thing
#
# Expected paths and names
# /tmp/dist/grafana-6.0.0-ca0bc2c5pre3.windows-amd64.zip
# /tmp/enterprise-dist/grafana-enterprise-6.0.0-29b28127pre3.windows-amd64.zip
#
# Optionally (mainly for testing), pass arguments to pull a specific build
#   -b,--build 5.4.3
#   -e,--enterprise add this flag to specify enterprise
#   -p,--premium, add this flag to include premium plugins
#
# When using the build option, the zip file is created in either dist or
# dist-enterprise according to the -e flag toggle.
#
# https://s3-us-west-2.amazonaws.com/grafana-releases/release/
#   grafana-{}.windows-amd64.zip
#
# https://dl.grafana.com/enterprise/release/
#   grafana-enterprise-{}.windows-amd64.zip
#
import os
import shutil
import argparse
from jinja2 import Template, Environment, FileSystemLoader

from utils import *

#############################
# Constants - DO NOT CHANGE #
#############################
OSS_UPGRADE_VERSION = '35c7d2a9-6e23-4645-b975-e8693a1cef10'
OSS_PRODUCT_NAME = 'Grafana OSS'
ENTERPRISE_UPGRADE_VERSION = 'd534ec50-476b-4edc-a25e-fe854c949f4f'
ENTERPRISE_PRODUCT_NAME = 'Grafana Enterprise'

#############################
# CONSTANTS
#############################
MSI_GENERATOR_VERSION = '1.0.0'
#############################
# PATHS
#############################
WIX_HOME = '/home/xclient/wix'
WINE_CMD = '/usr/bin/wine64'  # or just wine for 32bit
CANDLE = '{} {}/candle.exe'.format(WINE_CMD, WIX_HOME)
LIGHT = '{} {}/light.exe'.format(WINE_CMD, WIX_HOME)
HEAT = '{} {}/heat.exe'.format(WINE_CMD, WIX_HOME)
NSSM_VERSION = '2.24'
DIST_LOCATION = '/tmp/dist'
#############################
#
#############################
grafana_oss = {
    'feature_component_group_refs': [
        'GrafanaX64',
        'GrafanaServiceX64',
        'GrafanaFirewallExceptionsGroup'
    ],
    'directory_refs': [
        'GrafanaX64Dir'
    ],
    'components': [
        'grafana.wxs',
        'grafana-service.wxs',
        'grafana-firewall.wxs'
    ]
}


#
# Grafana 6 includes new datasources with long paths
#
def remove_long_paths():
    print('Removing long pathed files - these are not needed to run grafana')
    long_files = [
        '/tmp/a/grafana/public/app/plugins/datasource/grafana-azure-monitor-datasource/app_insights/app_insights_querystring_builder.test.ts',
        '/tmp/a/grafana/public/app/plugins/datasource/grafana-azure-monitor-datasource/app_insights/app_insights_querystring_builder.ts',
        '/tmp/a/grafana/public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_log_analytics/azure_log_analytics_datasource.test.ts',
        '/tmp/a/grafana/public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_log_analytics/azure_log_analytics_datasource.ts',
        '/tmp/a/grafana/public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_monitor/azure_monitor_datasource.test.ts',
        '/tmp/a/grafana/public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_monitor/azure_monitor_datasource.ts',
        '/tmp/a/grafana/public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_monitor/azure_monitor_filter_builder.test.ts',
        '/tmp/a/grafana/public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_monitor/azure_monitor_filter_builder.ts'
    ]
    for file in long_files:
        if os.path.isfile(file):
            print('Removing: {}'.format(file))
            os.remove(file)
        else:
            print('Skipped: {}'.format(file))


def build_oss(zip_file, extracted_name, PRODUCT_VERSION, config, features):
    # keep reference to source directory, will need to switch back and
    # forth during the process
    src_dir = os.getcwd()
    #  target_dir = tempfile.TemporaryDirectory()
    if not os.path.isdir('/tmp/a'):
        os.mkdir('/tmp/a')
    target_dir_name = '/tmp/a'
    extract_zip(zip_file, target_dir_name)
    # the zip file contains a version, which will not work when upgrading,
    # and ends up with paths longer
    # than light.exe can parse (windows issue)
    # Once extracted, rename it to grafana without the version included
    zip_file_path = '{}/{}'.format(target_dir_name, extracted_name)
    rename_to = '{}/grafana'.format(target_dir_name)
    print('Renaming extracted path {} to {}'.format(zip_file_path, rename_to))
    os.system('ls -al /tmp/a')
    print('Before:')
    os.rename(zip_file_path, rename_to)
    print('After:')
    os.system('ls -al /tmp/a')
    # cleanup due to MSI API limitation
    remove_long_paths()
    #
    # HEAT
    #
    # Collects the files from the path given and generates wxs file
    #
    print('Heat Harvesting')
    cgname = 'GrafanaX64'
    cgdir = 'GrafanaX64Dir'
    if not os.path.isdir('/tmp/scratch'):
        os.mkdir('/tmp/scratch')
    os.chdir('/tmp/scratch')
    outfile = 'grafana-oss.wxs'
    # important flags
    # -srd - prevents the parent directory name from being included in the
    #        harvest
    # -cg - component group to be referenced in main wxs file
    # -fr - directory ref to be used in main wxs file
    try:
        cmd = '''
          {} dir {} \
          -platform x64 \
          -sw5150 \
          -srd \
          -cg {} \
          -gg \
          -sfrag \
          -dr {} \
          -template fragment \
          -out {}'''.strip().format(HEAT, target_dir_name, cgname, cgdir, outfile)
        print(cmd)
        os.system(cmd)
    except Exception as ex:
        print(ex)

    shutil.copy2(outfile, target_dir_name)
    nssm_file = get_nssm('/tmp/cache', NSSM_VERSION)
    if not os.path.isdir(target_dir_name + '/nssm'):
        os.mkdir(target_dir_name + '/nssm')
    extract_zip(nssm_file, target_dir_name + '/nssm')
    print('HARVEST COMPLETE')
    os.chdir(src_dir)
    generate_firewall_wxs(env, PRODUCT_VERSION, '/tmp/scratch/grafana-firewall.wxs', target_dir_name)
    generate_service_wxs(env, PRODUCT_VERSION, '/tmp/scratch/grafana-service.wxs', target_dir_name, NSSM_VERSION)
    generate_product_wxs(env, config, features, '/tmp/scratch/product.wxs', target_dir_name)
    print('GENERATE COMPLETE')
    copy_static_files(target_dir_name)
    print('COPY STATIC COMPLETE')
    #
    # CANDLE needs to run in the scratch dir
    os.chdir('/tmp/scratch')
    try:
        filename = 'grafana-service.wxs'
        cmd = '{} -ext WixFirewallExtension -ext WixUtilExtension -v -arch x64 {}'.format(CANDLE, filename)
        print(cmd)
        os.system(cmd)
        shutil.copy2('grafana-service.wixobj', target_dir_name)
        #
        filename = 'grafana-firewall.wxs'
        cmd = '{} -ext WixFirewallExtension -ext WixUtilExtension -v -arch x64 {}'.format(
            CANDLE,
            filename)
        print(cmd)
        os.system(cmd)
        shutil.copy2('grafana-firewall.wixobj', target_dir_name)
        #
        filename = 'grafana-oss.wxs'
        cmd = '{} -ext WixFirewallExtension -ext WixUtilExtension -v -arch x64 {}'.format(
            CANDLE,
            filename)
        print(cmd)
        os.system(cmd)
        shutil.copy2('grafana-oss.wixobj', target_dir_name)
        #
        filename = 'product.wxs'
        cmd = '{} -ext WixFirewallExtension -ext WixUtilExtension -v -arch x64 {}'.format(
            CANDLE,
            filename)
        print(cmd)
        os.system(cmd)
        shutil.copy2('product.wixobj', target_dir_name)
    except Exception as ex:
        print(ex)
    print('CANDLE COMPLETE')
    ############################
    # LIGHT - Assemble the MSI
    ############################
    os.chdir(target_dir_name)
    os.system('cp -pr nssm/nssm-2.24 .')
    try:
        cmd = '''
          {} \
          -cultures:en-US \
          -ext WixUIExtension.dll -ext WixFirewallExtension -ext WixUtilExtension \
          -v -sval -spdb \
          grafana-service.wixobj \
          grafana-firewall.wixobj \
          grafana-oss.wixobj \
          product.wixobj \
          -out grafana.msi'''.strip().format(LIGHT)
        print(cmd)
        os.system(cmd)
    except Exception as ex:
        print(ex)
    # copy to scratch with version included
    msi_filename = '/tmp/scratch/{}.windows-amd64.msi'.format(extracted_name)
    shutil.copy2('grafana.msi', msi_filename)
    os.system('ls -al /tmp/scratch')
    print('LIGHT COMPLETE')
    # finally cleanup
    # extract_dir.cleanup()


def main(file_loader, env, grafana_version, zip_file, extracted_name):
    UPGRADE_VERSION = OSS_UPGRADE_VERSION
    GRAFANA_VERSION = grafana_version
    PRODUCT_NAME = OSS_PRODUCT_NAME
    # PRODUCT_VERSION=GRAFANA_VERSION
    # MSI version cannot have anything other
    # than a x.x.x.x format, numbers only
    PRODUCT_VERSION = GRAFANA_VERSION.split('-')[0]

    config = {
        'grafana_version': PRODUCT_VERSION,
        'upgrade_code': UPGRADE_VERSION,
        'product_name': PRODUCT_NAME,
        'manufacturer': 'Grafana Labs'
    }
    features = [
        {
            'name': 'GrafanaOSS',
            'title': PRODUCT_NAME,
            'component_groups': [
                {
                    'ref_id': 'GrafanaX64',
                    'directory': 'GrafanaX64Dir'
                }
            ]
        },
        {
            'name': 'GrafanaService',
            'title': 'Run Grafana as a Service',
            'component_groups': [
                {
                    'ref_id': 'GrafanaServiceX64',
                    'directory': 'GrafanaServiceX64Dir'
                }
            ]
        }
    ]
    build_oss(zip_file, extracted_name, PRODUCT_VERSION, config, features)


if __name__ == '__main__':
    print('MSI Generator Version: {}'.format(MSI_GENERATOR_VERSION))

    parser = argparse.ArgumentParser(
        description='Grafana MSI Generator',
        formatter_class=lambda prog: argparse.HelpFormatter(prog, max_help_position=90, width=110), add_help=True)
    parser.add_argument(
        '-p',
        '--premium',
        help='Include premium plugins',
        dest='premium', action='store_true')
    parser.add_argument(
        '-e',
        '--enterprise',
        help='Use Enterprise build',
        dest='enterprise',
        action='store_true')
    parser.set_defaults(enterprise=False, premium=False)
    parser.add_argument('-b', '--build', help='build to download')
    args = parser.parse_args()
    file_loader = FileSystemLoader('templates')
    env = Environment(loader=file_loader)
    grafana_version = None
    grafana_hash = None
    is_enterprise = False
    if not os.path.isdir(DIST_LOCATION):
        os.mkdir(DIST_LOCATION)
    # if a build version is specified, pull it
    if args.build:
        grafana_version = args.build
        print('Version Specified: {}'.format(grafana_version))
    else:
        grafana_version, grafana_hash, is_enterprise = detect_version(DIST_LOCATION)

    # check for enterprise flag
    if args.enterprise:
        grafana_version = 'enterprise-{}'.format(args.build)
    #
    print('Detected Version: {}'.format(grafana_version))
    if grafana_hash:
        print('Detected Hash: {}'.format(grafana_hash))
    print('Enterprise: {}'.format(is_enterprise))
    if is_enterprise:
        zip_file = '{}/grafana-enterprise-{}.windows-amd64.zip'.format(DIST_LOCATION, grafana_version)
        extracted_name = 'grafana-enterprise-{}'.format(grafana_version)
    else:
        # the file can have a build hash
        if grafana_hash:
            zip_file = '{}/grafana-{}-{}.windows-amd64.zip'.format(DIST_LOCATION, grafana_version, grafana_hash)
            extracted_name = 'grafana-{}-{}'.format(grafana_version, grafana_hash)
        else:
            zip_file = '{}/grafana-{}.windows-amd64.zip'.format(DIST_LOCATION, grafana_version)
            extracted_name = 'grafana-{}'.format(grafana_version)
    print('ZipFile: {}'.format(zip_file))
    # check if file downloaded

    if not os.path.isfile(zip_file):
        zip_file = get_zip(grafana_version, zip_file)
    main(file_loader, env, grafana_version, zip_file, extracted_name)
