import zipfile
import os
import glob
import re
import shutil
import wget


def extract_zip(filename, target_dir):
    with zipfile.ZipFile(filename, 'r') as zip_ref:
        zip_ref.extractall(target_dir)


def get_nssm(tmpPath, version):
    if not os.path.isdir(tmpPath):
        os.mkdir(tmpPath)
    target_filename = '{}/nssm-{}.zip'.format(tmpPath, version)
    exists = os.path.isfile(target_filename)
    if exists:
        return target_filename
    url = 'https://nssm.cc/release/nssm-{}.zip'.format(version)
    print('NSSM url is {}'.format(url))
    filename = wget.download(url, out=target_filename, bar=wget.bar_thermometer)
    return filename


def get_zip(version, target_filename):
    exists = os.path.isfile(target_filename)
    if exists:
        return target_filename
    url = 'https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana-{}.windows-amd64.zip'.format(version)
    #url = 'https://dl.grafana.com/enterprise/release/grafana-enterprise-{}.windows-amd64.zip'.format(version)
    filename = wget.download(url, out=target_filename, bar=wget.bar_thermometer)
    return filename


#
#
#
def detect_version(dist_path):
    detectedVersion = ''
    detectedHash = ''
    isEnterprise = False
    print("Detecting Version...")
    # grafana-6.0.0-ca0bc2c5pre3.windows-amd64.zip
    # get files in directory matching pattern
    fileList = glob.glob(dist_path + '/grafana*.windows-amd64.zip')
    print(fileList)
    if len(fileList) == 0:
        print('Skipping detection, no matches')
        return
    firstFile = fileList[0]
    p1 = re.search(r'grafana-(enterprise-)?(\d\.\d\.\d)-(.+)\.windows-amd64\.zip$', firstFile)
    p2 = re.search(r'grafana-(enterprise-)?(\d\.\d\.\d)\.windows-amd64\.zip$', firstFile)
    if p1:
        detectedVersion = p1.group(2)
        detectedHash = p1.group(3)
        if p1.group(1) == 'enterprise-':
          isEnterprise = True
    if p2:
        detectedVersion = p2.group(2)
        if p2.group(1) == 'enterprise-':
          isEnterprise = True

    return detectedVersion, detectedHash, isEnterprise

    #if os.path.isdir(dist_path + 'enterprise-dist'):
    #    # grafana-enterprise-6.0.0-29b28127pre3.windows-amd64.zip
    #    # get files in directory matching pattern
    #    fileList = glob.glob(dist_path + '/enterprise-dist/grafana*.windows-amd64.zip')
    #    firstFile = fileList[0]
    #    p1 = re.search(r'grafana-enterprise-(\d\.\d\.\d)\.windows-amd64.zip$', firstFile)
    #    p2 = re.search(r'grafana-enterprise-(\d\.\d\.\d)-(.*)\.windows-amd64.zip$', firstFile)
    #    if p1:
    #        detectedVersion = p1.group(1)
    #        isEnterprise = True
    #    if p2:
    #        detectedVersion = p2.group(1)
    #        detectedHash = p2.group(2)
    #        isEnterprise = True
    #    return detectedVersion, detectedHash, isEnterprise


def generate_product_wxs(env, config, features, scratch_file, target_dir):
    template = env.get_template('common/product.wxs.j2')
    output = template.render(config=config, features=features)
    fh = open(scratch_file, 'w')
    fh.write(output)
    fh.close()
    shutil.copy2(scratch_file, target_dir)

def generate_service_wxs(env, grafana_version, scratch_file, target_dir, nssm_version='2.24'):
    template = env.get_template('common/grafana-service.wxs.j2')
    output = template.render(grafana_version=grafana_version, nssm_version=nssm_version)
    fh = open(scratch_file, 'w')
    fh.write(output)
    fh.close()
    shutil.copy2(scratch_file, target_dir)

def generate_firewall_wxs(env, grafana_version, scratch_file, target_dir):
    os.system("ls -al templates")
    template = env.get_template('common/grafana-firewall.wxs.j2')
    output = template.render(grafana_version=grafana_version)
    fh = open(scratch_file, 'w')
    fh.write(output)
    fh.close()
    shutil.copy2(scratch_file, target_dir)


def generate_oracle_environment_wxs(env, instant_client_version, scratch_file, target_dir):
    template = env.get_template('oracle/oracle-environment.wxs.j2')
    output = template.render(instant_client_version=instant_client_version)
    fh = open(scratch_file, 'w')
    fh.write(output)
    fh.close()
    shutil.copy2(scratch_file, target_dir)

def copy_static_files(target_dir):
    for item in os.listdir('resources/images'):
        s = os.path.join('resources/images', item)
        d = os.path.join(target_dir, item)
        shutil.copy2(s, d)
    for item in os.listdir('resources/license'):
        s = os.path.join('resources/license', item)
        d = os.path.join(target_dir, item)
        shutil.copy2(s, d)
