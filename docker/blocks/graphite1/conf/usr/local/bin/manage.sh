#!/bin/bash
PYTHONPATH=/opt/graphite/webapp django-admin.py syncdb --settings=graphite.settings
PYTHONPATH=/opt/graphite/webapp django-admin.py update_users --settings=graphite.settings