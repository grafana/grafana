FROM alpine 
USER root 
ADD scripts scripts
ADD install /usr/local
WORKDIR scripts
RUN ./deploy.sh
