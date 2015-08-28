#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
* @python name:		open-falcon/geo.py
* @description:		This file gets geocode data.
* @related issues:	OWL-052
* @author:			Don Hsieh
* @since:			08/24/2015
* @last modified:	08/27/2015
* @called by:
"""
# sudo apt-get update; sudo apt-get install -y python-xlrd python-mysqldb python-pip; sudo pip install requests xlwt beautifulsoup4

from __future__ import division
import requests
import urllib
import sys
import os
import re
import time
from datetime import datetime
from datetime import timedelta
import json
import shutil
from dateutil.relativedelta import *

"""
* @def name:		getNow(format=None)
* @description:		This function returns a string of time of now.
* @related issues:	OWL-052
* @param:			string format=None
* @return:			string now
* @author:			Don Hsieh
* @since:			06/17/2014
* @last modified:	06/17/2014
* @called by:		def download(images)
*					 in open-falcon/geo.py
"""
def getNow(format=None):
	#if format is None: format = '%Y/%m/%d %a %H:%M:%S'
	if format is None: format = '%Y-%m-%d %H:%M:%S'
	now = datetime.now().strftime(format)
	return now

"""
* @def name:		convertIpToLocation()
* @description:		This function exports data from table to xls file.
* @related issues:	OWL-052
* @param:			void
* @return:			void
* @author:			Don Hsieh
* @since:			08/22/2015
* @last modified:	08/22/2015
* @called by:		main
*					 in open-falcon/geo.py
"""
def convertIpToLocation():
	path = os.path.dirname(os.path.realpath(__file__))
	jsonFile = os.path.join(path, 'data', 'api.json')
	with open(jsonFile) as data_file:
		data = json.load(data_file)
		l = data['result']

		sum = 0
		ips = []
		for key, value in enumerate(data['result']):
			sum += len(value['ip_list'])
			# print str(key + 1) + '\t' + value['platform'] + '\t' + str(len(value['ip_list']))
			for host in value['ip_list']:
				ips.append(host['ip'])
		ips = list(set(ips))
		ips.sort()
		
		headers = {
			"User-Agent": "Mozilla/5.0 (Windows NT 6.3; WOW64; rv:37.0) Gecko/20100101 Firefox/37.0",
			"Accept-Encoding": "gzip, deflate",
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.5",
			"Connection": "keep-alive"
		}
		l = []
		for key, ip in enumerate(ips):
			print(str(key) + '\t' + ip + '\t' + getNow())
			url = 'http://int.dpool.sina.com.cn/iplookup/iplookup.php?format=json&ip=' + ip
			# try:
			r = requests.get(url, headers=headers)
			# r = requests.get(url, headers=headers, timeout=20)
			data = json.loads(r.text)
			country = data["country"].strip()
			province = data["province"].strip()
			if province == u'上海':
				city = province
			else: city = data["city"].strip()
			item = {'ip': ip, 'province': province, 'city': city, 'country': country}
			# print(item)
			print(json.dumps(item, ensure_ascii=False))
			l.append(item)
			# except requests.exceptions.Timeout as e:
			# 	# Maybe set up for a retry, or continue in a retry loop
			# 	print 'Exception: Timeout'
			# 	print e
			# except requests.exceptions.ConnectionError as e:
			# 	# A Connection error occurred.
			# 	print 'Exception: ConnectionError'
			# 	print e
			# except requests.exceptions.HTTPError as e:
			# 	# An HTTP error occurred.
			# 	print 'Exception: HTTPError'
			# 	print e
			# except requests.exceptions.TooManyRedirects as e:
			# 	# Too many redirects.
			# 	# Tell the user their URL was bad and try a different one
			# 	print 'Exception: TooManyRedirects'
			# 	print e
			# except requests.exceptions.URLRequired as e:
			# 	# A valid URL is required to make a request.
			# 	print 'Exception: Valid URL Required'
			# 	print e
			# except requests.exceptions.RequestException as e:
			# 	# There was an ambiguous exception that occurred while handling your request.
			# 	# catastrophic error. bail.
			# 	print 'Exception: Ambiguous requests exception'
			# 	print e
			# except IOError as e:
			# 	print "I/O error({0}): {1}".format(e.errno, e.strerror)
			# 	print 'Cannot find URL'
			# 	print type(e)
			# 	print e
			# except:
			# 	print "Unexpected error:", sys.exc_info()[0]

		s = json.dumps(l, ensure_ascii=False)

		jsonFile = os.path.join(path, 'data', 'ip.json')
		print(jsonFile)

		with open(jsonFile, 'w') as the_file:
			the_file.write(s.encode('utf8'))

"""
* @def name:		getCitiesCount()
* @description:		This function exports data from table to xls file.
* @related issues:	OWL-052
* @param:			void
* @return:			void
* @author:			Don Hsieh
* @since:			08/22/2015
* @last modified:	08/22/2015
* @called by:		main
*					 in open-falcon/geo.py
"""
def getCitiesCount():
	path = os.path.dirname(os.path.realpath(__file__))
	jsonFile = os.path.join(path, 'data', 'ip.json')
	print(jsonFile)
	with open(jsonFile) as data_file:
		data = json.load(data_file)
		obj = {}
		for key, item in enumerate(data):
			country = item["country"].strip()
			province = item["province"].strip()
			city = item["city"].strip()
			# if len(city) < 2: city = 'no_city'
			isNew = False
			if country not in obj:
				obj[country] = {'count': 1}
				isNew = True
			if province not in obj[country]:
				key = obj[country]
				key[province] = {'count': 1}
				obj[country] = key
				isNew = True
			key = obj[country]
			if city not in key[province]:
				key2 = key[province]
				# key2[city] = 1
				key2[city] = {'count': 1}
				key[province] = key2
				obj[country] = key
				isNew = True
			if not isNew:
				key = obj[country]
				key2 = key[province]
				key3 = key2[city]
				key3['count'] = key3['count'] + 1
				key2[city] = key3
				cnt = 0
				for value in key2:
					if value != 'count':
						key3 = key2[value]
						cnt += key3['count']
				key2['count'] = cnt
				key[province] = key2
				cnt = 0
				for value in key:
					if value != 'count':
						province = key[value]
						cnt += province['count']
				key['count'] = cnt
				obj[country] = key
		s = json.dumps(obj, ensure_ascii=False)

		jsonFile = os.path.join(path, 'data', 'city.json')
		# print(jsonFile)

		with open(jsonFile, 'w') as the_file:
			the_file.write(s.encode('utf8'))

"""
* @def name:		getGoogleMapGeocodeJson(city)
* @description:		This function exports data from table to xls file.
* @related issues:	OWL-052
* @param:			string city
* @return:			JSON data
* @author:			Don Hsieh
* @since:			08/22/2015
* @last modified:	08/22/2015
* @called by:		main
*					 in open-falcon/geo.py
"""
def getGoogleMapGeocodeJson(city):
	time.sleep(1)
	headers = {
		"User-Agent": "Mozilla/5.0 (Windows NT 6.3; WOW64; rv:37.0) Gecko/20100101 Firefox/37.0",
		"Accept-Encoding": "gzip, deflate",
		"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		"Accept-Language": "en-US,en;q=0.5",
		"Connection": "keep-alive"
	}
	url = 'http://maps.googleapis.com/maps/api/geocode/json?address=' + city
	r = requests.get(url, headers=headers, timeout=20)
	data = r.text
	if type(data) != type({}):
		data = json.loads(data)
	return data

"""
* @def name:		getGeocode(json)
* @description:		This function exports data from table to xls file.
* @related issues:	OWL-052
* @param:			JSON data
* @return:			dict location
* @author:			Don Hsieh
* @since:			08/22/2015
* @last modified:	08/22/2015
* @called by:		main
*					 in open-falcon/geo.py
"""
def getGeocode(data):
	if data['status'] != 'OK':
		print data
		raise
	else :
		data = data['results']
		data = data[0]
		data = data['geometry']
		location = data['location']
	return location

"""
* @def name:		convertLocationToGeocode()
* @description:		This function exports data from table to xls file.
* @related issues:	OWL-052
* @param:			void
* @return:			void
* @author:			Don Hsieh
* @since:			08/24/2015
* @last modified:	08/24/2015
* @called by:		main
*					 in open-falcon/geo.py
"""
def convertLocationToGeocode():
	path = os.path.dirname(os.path.realpath(__file__))
	jsonFile = os.path.join(path, 'data', 'city.json')
	with open(jsonFile) as data_file:
		data = json.load(data_file)
		geocodes = []
		for key in data:
			china = data[key]
			print china['count']
			for key2 in china:
				if key2 != 'count':
					geocodeProvince = getGoogleMapGeocodeJson(key2 + '+province')
					geocodes.append(geocodeProvince)
					locationProvince = getGeocode(geocodeProvince)
					province = china[key2]
					province['lat'] = locationProvince['lat']
					province['lng'] = locationProvince['lng']
					# print key2 + '\t' + str(province['lng']) + ',' + str(province['lat']) + '\t' + str(province['count'])
					for key3 in province:
						if key3 != 'count' and key3 != '' and key3 != 'lat' and key3 != 'lng':
							geocodeCity = getGoogleMapGeocodeJson(key3 + '+city')
							geocodes.append(geocodeCity)
							locationCity = getGeocode(geocodeCity)
							city = province[key3]
							city['lat'] = locationCity['lat']
							city['lng'] = locationCity['lng']
							# print '\t' + key3 + '\t' + str(city['lng']) + ',' + str(city['lat']) + '\t' + str(city['count'])
							province[key3] = city
					china[key2] = province
			data[key] = china

		s = json.dumps(geocodes, ensure_ascii=False)
		jsonFile = os.path.join(path, 'data', 'geocodes.json')
		with open(jsonFile, 'w') as the_file:
			the_file.write(s.encode('utf8'))

		s = json.dumps(data, ensure_ascii=False)
		jsonFile = os.path.join(path, 'data', 'latlng.json')
		with open(jsonFile, 'w') as the_file:
			the_file.write(s.encode('utf8'))


# convertIpToLocation()
# getCitiesCount()
convertLocationToGeocode()

path = os.path.dirname(os.path.realpath(__file__))
jsonFile = os.path.join(path, 'data', 'latlng.json')
print(jsonFile)
with open(jsonFile) as data_file:
	data = json.load(data_file)
	results = []
	obj = {}
	for key in data:
		china = data[key]
		for key2 in china:
			if key2 != 'count':
				province = china[key2]
				obj = {
					"name": key2,
					"coord": [province['lng'],province['lat']],
					"value": province['count']
				}
				results.append(obj)
	s = json.dumps(results, ensure_ascii=False)
	# print s

	jsonFile = os.path.join(path, 'data', 'province.json')
	# print(jsonFile)
	with open(jsonFile, 'w') as the_file:
		the_file.write(s.encode('utf8'))

print("Done")